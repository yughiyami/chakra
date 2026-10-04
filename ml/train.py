"""Train Chakra's on-device coffee leaf classifier with calibrated abstention (v3: localized, 6 classes).

Pipeline:
  1. BRACOL leaf set (Esgario et al. 2020, Brazil, CC BY 4.0) + a small LOCAL slice of the
     Saposoa set (San Martin, Peru, CC BY 4.0): healthy, rust and ojo de gallo (Mycena citricolor,
     absent from every public non-Peruvian set), 1/3 train / 1/6 calib / rest held out per class.
     Unseen test the model must abstain on: CoLeaf-DB nutrient-deficiency leaves (Jaen, Peru;
     iron and nitrogen), never used for training or calibration.
  2. Fine-tune timm mobilenetv3_small_100 (ImageNet init) on CPU.
  3. Temperature scaling on val (Guo et al., 2017).
  4. Three abstention gates fitted on the (mixed-domain) calibration split:
       - energy score  E(x) = -T*logsumexp(z/T)            (Liu et al., NeurIPS 2020)
       - Mahalanobis distance on PCA-reduced penultimate features, tied covariance
                                                            (Lee et al., NeurIPS 2018)
       - split conformal prediction, LAC score, alpha=0.10 (Angelopoulos & Bates, 2021)
     Each OOD threshold keeps 95% of in-distribution calibration samples.
  5. Report: BRACOL test, Saposoa held-out test, ojo de gallo abstention, AUROC per OOD score,
     far-OOD (noise/flat images).
  6. Export ONNX (normalization inside the graph, outputs: logits + features). Static int8 was
     evaluated in v1 and collapsed accuracy (34% top-1) on MobileNetV3, so we ship fp32 (~6 MB).

Run:  python train.py
"""
from __future__ import annotations

import json
import os
import random
import time
from pathlib import Path

import numpy as np
import pandas as pd
import timm
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageOps
from sklearn.metrics import roc_auc_score

ROOT = Path(__file__).parent
BRACOL = ROOT / "data/bracol/coffee-datasets/coffee-datasets/leaf"
SAPOSOA = ROOT / "data/saposoa"
OUT = ROOT.parent / "public/model"
RUNS = ROOT / "runs"
CLASSES = ["healthy", "leaf_miner", "rust", "brown_leaf_spot", "cercospora", "ojo_de_gallo"]
SIZE, CACHE = 224, 256
ALPHA = 0.10
ID_RECALL = 0.95
PCA_K = 32
EPOCHS = int(os.environ.get("EPOCHS", 15))
COLEAF = ROOT / "data/coleaf"
UNSEEN_MAX = 120
LOCAL_OVERSAMPLE = 3
SEED = 7
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)

torch.manual_seed(SEED); random.seed(SEED); np.random.seed(SEED)
torch.set_num_threads(os.cpu_count() or 4)


def load(path: Path, size: int) -> torch.Tensor:
    """Squash-resize the whole image (matches the browser canvas path exactly)."""
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB").resize((size, size), Image.BILINEAR, reducing_gap=2.0)
    return torch.from_numpy(np.asarray(img).copy()).permute(2, 0, 1)  # uint8 CHW


def bracol_split():
    df = pd.read_csv(BRACOL / "dataset.csv")
    df = df[df.predominant_stress.between(0, 4)]
    df = df[df.id.apply(lambda i: (BRACOL / f"images/{i}.jpg").exists())].reset_index(drop=True)
    parts = {"train": [], "val": [], "calib": [], "test": []}
    for _, g in df.groupby("predominant_stress"):
        idx = g.sample(frac=1, random_state=SEED).index.tolist()
        n = len(idx)
        a, b, c = int(0.60 * n), int(0.70 * n), int(0.85 * n)
        parts["train"] += idx[:a]; parts["val"] += idx[a:b]; parts["calib"] += idx[b:c]; parts["test"] += idx[c:]
    return df, parts


def bracol_tensors(df, idx, size):
    x = torch.stack([load(BRACOL / f"images/{df.id[i]}.jpg", size) for i in idx])
    y = torch.tensor([int(df.predominant_stress[i]) for i in idx])
    return x, y


def saposoa_split():
    """Per-class local split. Returns dict of (paths, label_idx) lists."""
    man = json.loads((SAPOSOA / "manifest.json").read_text())
    rng = random.Random(SEED)
    split = {"train": [], "calib": [], "test": [], "ood": []}
    for label in ["healthy", "rust", "ojo_de_gallo"]:
        files = sorted({SAPOSOA / m["file"] for m in man if m["label"] == label})
        rng.shuffle(files)
        y = CLASSES.index(label)
        n_tr, n_ca = len(files) // 3, len(files) // 6
        split["train"] += [(f, y) for f in files[:n_tr]]
        split["calib"] += [(f, y) for f in files[n_tr:n_tr + n_ca]]
        split["test"] += [(f, y) for f in files[n_tr + n_ca:]]
    unseen = sorted(p for p in COLEAF.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    rng.shuffle(unseen)
    split["ood"] = [(p, -1) for p in unseen[:UNSEEN_MAX]]
    return split


def path_tensors(items, size):
    return torch.stack([load(f, size) for f, _ in items]), torch.tensor([y for _, y in items])


def augment(x: torch.Tensor) -> torch.Tensor:
    """Field-ish augmentation on uint8 CACHE-size batch -> float SIZE batch in [0,1]."""
    out = []
    for img in x:
        img = img.float() / 255
        s = random.uniform(0.55, 1.0); h = w = int(CACHE * s)
        t = random.randint(0, CACHE - h); l = random.randint(0, CACHE - w)
        img = img[:, t:t + h, l:l + w]
        img = F.interpolate(img[None], size=(SIZE, SIZE), mode="bilinear", align_corners=False)[0]
        if random.random() < 0.5: img = img.flip(2)
        if random.random() < 0.5: img = img.flip(1)
        img = torch.rot90(img, random.randint(0, 3), (1, 2))
        b, c, sat = random.uniform(0.6, 1.4), random.uniform(0.7, 1.3), random.uniform(0.6, 1.4)
        gray = img.mean(0, keepdim=True)
        img = ((img - gray) * sat + gray)
        img = ((img - img.mean()) * c + img.mean()) * b
        img = img + torch.randn(3, 1, 1) * 0.03  # white-balance shift
        if random.random() < 0.3:
            img = F.avg_pool2d(img[None], 3, 1, 1)[0]  # blur
        out.append(img.clamp(0, 1))
    return torch.stack(out)


def to_float(x: torch.Tensor) -> torch.Tensor:
    x = x.float() / 255
    if x.shape[-1] != SIZE:
        x = F.interpolate(x, size=(SIZE, SIZE), mode="bilinear", align_corners=False)
    return x


class Deployable(nn.Module):
    """Input: float32 RGB in [0,1], NCHW 224. Outputs: logits [N,5], features [N,1024]."""

    def __init__(self, net):
        super().__init__()
        self.net = net
        self.register_buffer("mean", MEAN.clone())
        self.register_buffer("std", STD.clone())

    def forward(self, x):
        f = self.net.forward_head(self.net.forward_features((x - self.mean) / self.std), pre_logits=True)
        return self.net.classifier(f), f


@torch.no_grad()
def run_model(model, x, bs=64):
    model.eval()
    zs, fs = zip(*[model(to_float(x[i:i + bs])) for i in range(0, len(x), bs)])
    return torch.cat(zs), torch.cat(fs)


def fit_temperature(z, y):
    t = torch.ones(1, requires_grad=True)
    opt = torch.optim.LBFGS([t], lr=0.05, max_iter=200)
    def step():
        opt.zero_grad(); loss = F.cross_entropy(z / t.clamp(min=0.05), y); loss.backward(); return loss
    opt.step(step)
    return float(t.detach().clamp(min=0.05))


def energy(z, T):
    return -T * torch.logsumexp(z / T, dim=1)


def fit_mahalanobis(f, y):
    """PCA(k) + class means + tied, shrunk covariance. Everything JSON-serializable for the browser."""
    mu = f.mean(0)
    _, _, V = torch.pca_lowrank(f - mu, q=PCA_K, center=False, niter=6)
    comps = V[:, :PCA_K].T  # [k, D]
    g = (f - mu) @ comps.T
    means = torch.stack([g[y == c].mean(0) for c in range(len(CLASSES))])
    resid = g - means[y]
    cov = resid.T @ resid / len(g)
    cov = 0.9 * cov + 0.1 * torch.eye(PCA_K) * cov.diag().mean()  # shrinkage for stability
    return {"feat_mean": mu, "components": comps, "class_means": means, "precision": torch.linalg.inv(cov)}


def mahalanobis(f, m):
    g = (f - m["feat_mean"]) @ m["components"].T
    d = g[:, None, :] - m["class_means"][None]
    return torch.einsum("nck,kl,ncl->nc", d, m["precision"], d).min(1).values


def fit_gates(z_cal, f_cal, y_cal, T, maha):
    p = F.softmax(z_cal / T, 1)
    scores = 1 - p[torch.arange(len(y_cal)), y_cal]  # LAC nonconformity
    n = len(scores)
    q_level = min(1.0, np.ceil((n + 1) * (1 - ALPHA)) / n)
    return {"temperature": T, "alpha": ALPHA, "n_calib": n, "id_recall": ID_RECALL,
            "qhat": float(torch.quantile(scores, q_level, interpolation="higher")),
            "energy_threshold": float(torch.quantile(energy(z_cal, T), ID_RECALL)),
            "mahalanobis_threshold": float(torch.quantile(mahalanobis(f_cal, maha), ID_RECALL))}


def decide(z, f, gates, maha):
    """Returns (pred, set_mask, abstain_reason) per sample. Mirrors src/core/gates.js exactly."""
    T = gates["temperature"]
    p = F.softmax(z / T, 1)
    sets = p >= (1 - gates["qhat"])
    e, m = energy(z, T), mahalanobis(f, maha)
    res = []
    for i in range(len(z)):
        if e[i] > gates["energy_threshold"] or m[i] > gates["mahalanobis_threshold"]:
            res.append((None, sets[i], "unfamiliar"))
        elif sets[i].sum() != 1:
            res.append((None, sets[i], "ambiguous" if sets[i].sum() > 1 else "unfamiliar"))
        else:
            res.append((int(p[i].argmax()), sets[i], None))
    return res


def ece(p, y, bins=10):
    conf, pred = p.max(1)
    acc = (pred == y).float()
    e = 0.0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        msk = (conf > lo) & (conf <= lo + 1 / bins)
        if msk.any():
            e += msk.float().mean().item() * abs(acc[msk].mean().item() - conf[msk].mean().item())
    return e


def report(z, f, y, gates, maha, name):
    d = decide(z, f, gates, maha)
    top1 = (z.argmax(1) == y).float().mean().item()
    covered = np.mean([bool(s[int(t)]) for (_, s, _), t in zip(d, y)])
    answered = [(p, int(t)) for (p, _, _), t in zip(d, y) if p is not None]
    sel = np.mean([p == t for p, t in answered]) if answered else float("nan")
    r = {"set": name, "n": len(y), "top1_acc": round(top1, 4), "conformal_coverage": round(float(covered), 4),
         "answer_rate": round(len(answered) / len(y), 4), "selective_acc": round(float(sel), 4),
         "avg_set_size": round(float(np.mean([s.sum().item() for _, s, _ in d])), 3),
         "ece": round(ece(F.softmax(z / gates["temperature"], 1), y), 4)}
    print(r)
    return r


def ood_report(z_id, f_id, z_ood, f_ood, gates, maha, name):
    """AUROC is computed against the local (Peru) in-distribution test set."""
    T = gates["temperature"]
    d = decide(z_ood, f_ood, gates, maha)
    lab = np.r_[np.zeros(len(z_id)), np.ones(len(z_ood))]
    auroc = {
        "max_softmax": roc_auc_score(lab, -torch.cat([F.softmax(z_id / T, 1), F.softmax(z_ood / T, 1)]).max(1).values.numpy()),
        "energy": roc_auc_score(lab, torch.cat([energy(z_id, T), energy(z_ood, T)]).numpy()),
        "mahalanobis": roc_auc_score(lab, torch.cat([mahalanobis(f_id, maha), mahalanobis(f_ood, maha)]).numpy()),
    }
    r = {"set": name, "n": len(z_ood), "abstention_rate": round(float(np.mean([p is None for p, _, _ in d])), 4),
         "wrongly_answered_as": pd.Series([CLASSES[p] for p, _, _ in d if p is not None], dtype=str).value_counts().to_dict(),
         "auroc_vs_local_id": {k: round(float(v), 4) for k, v in auroc.items()}}
    print(r)
    return r


def far_ood(model, gates, maha):
    """Non-leaf synthetic inputs (noise, flat colours) must be rejected."""
    g = torch.Generator().manual_seed(SEED)
    noise = (torch.rand(40, 3, SIZE, SIZE, generator=g) * 255).to(torch.uint8)
    flat = torch.stack([torch.full((3, SIZE, SIZE), int(v)) for v in torch.randint(0, 255, (40,), generator=g)]).to(torch.uint8)
    z, f = run_model(model, torch.cat([noise, flat]))
    return {"n": 80, "rejection_rate": round(float(np.mean([p is None for p, _, _ in decide(z, f, gates, maha)])), 4)}


def train_model(xtr, ytr, xva, yva, t0):
    net = timm.create_model("mobilenetv3_small_100", pretrained=True, num_classes=len(CLASSES), drop_rate=0.2)
    model = Deployable(net)
    counts = torch.bincount(ytr, minlength=len(CLASSES)).float()
    weights = (counts.sum() / (len(CLASSES) * counts)).clamp(max=4)
    head = list(net.get_classifier().parameters())
    head_ids = {id(p) for p in head}
    body = [p for p in net.parameters() if id(p) not in head_ids]
    opt = torch.optim.AdamW([{"params": body, "lr": 3e-4}, {"params": head, "lr": 2e-3}], weight_decay=1e-4)
    steps = EPOCHS * ((len(xtr) + 31) // 32)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[3e-4, 2e-3], total_steps=steps, pct_start=0.15)
    best, best_state = -1, None
    for ep in range(EPOCHS):
        model.train()
        perm = torch.randperm(len(xtr))
        tl = 0.0
        for i in range(0, len(xtr), 32):
            b = perm[i:i + 32]
            logits, _ = model(augment(xtr[b]))
            loss = F.cross_entropy(logits, ytr[b], weight=weights, label_smoothing=0.1)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            tl += loss.item() * len(b)
        va = (run_model(model, xva)[0].argmax(1) == yva).float().mean().item()
        print(f"epoch {ep + 1}/{EPOCHS} loss {tl / len(xtr):.3f} val_acc {va:.3f} ({time.time() - t0:.0f}s)")
        if va >= best:
            best, best_state = va, {k: v.clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    return model, best


def main():
    t0 = time.time()
    RUNS.mkdir(exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    df, parts = bracol_split()
    sap = saposoa_split()
    print({k: len(v) for k, v in parts.items()}, {k: len(v) for k, v in sap.items()})

    xb_tr, yb_tr = bracol_tensors(df, parts["train"], CACHE)
    xs_tr, ys_tr = path_tensors(sap["train"], CACHE)
    xtr = torch.cat([xb_tr] + [xs_tr] * LOCAL_OVERSAMPLE)
    ytr = torch.cat([yb_tr] + [ys_tr] * LOCAL_OVERSAMPLE)
    xva, yva = bracol_tensors(df, parts["val"], SIZE)
    xb_ca, yb_ca = bracol_tensors(df, parts["calib"], SIZE)
    xs_ca, ys_ca = path_tensors(sap["calib"], SIZE)
    xca, yca = torch.cat([xb_ca, xs_ca]), torch.cat([yb_ca, ys_ca])
    xte, yte = bracol_tensors(df, parts["test"], SIZE)
    xs_te, ys_te = path_tensors(sap["test"], SIZE)
    xood, _ = path_tensors(sap["ood"], SIZE)
    print(f"loaded in {time.time() - t0:.0f}s")

    model, best = train_model(xtr, ytr, xva, yva, t0)
    torch.save(model.state_dict(), RUNS / "best.pt")

    # Gates are fitted on the exact ONNX graph that ships, via onnxruntime.
    import onnx
    import onnxruntime as ort
    model.eval()
    onnx_path = RUNS / "chakra_fp32.onnx"
    torch.onnx.export(model, torch.rand(1, 3, SIZE, SIZE), onnx_path, input_names=["image"],
                      output_names=["logits", "features"], opset_version=17,
                      dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}, "features": {0: "batch"}}, dynamo=False)
    onnx.checker.check_model(onnx.load(onnx_path))
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])

    def fn(x, bs=32):
        outs = [sess.run(None, {"image": to_float(x[i:i + bs]).numpy()}) for i in range(0, len(x), bs)]
        return torch.cat([torch.from_numpy(o[0]) for o in outs]), torch.cat([torch.from_numpy(o[1]) for o in outs])

    # parity check torch vs onnxruntime
    zt, _ = run_model(model, xte[:16]); zo, _ = fn(xte[:16])
    parity = float((zt - zo).abs().max())
    print("max |torch - ort| logit diff:", parity)

    z_va, _ = fn(xva)
    T = fit_temperature(z_va, yva)
    _, f_tr = fn(torch.cat([xb_tr, xs_tr]))
    maha = fit_mahalanobis(f_tr, torch.cat([yb_tr, ys_tr]))
    z_ca, f_ca = fn(xca)
    gates = fit_gates(z_ca, f_ca, yca, T, maha)

    z_te, f_te = fn(xte); zs, fs = fn(xs_te); zo_, fo_ = fn(xood)
    metrics = {
        "bracol_test": report(z_te, f_te, yte, gates, maha, "bracol_test"),
        "saposoa_test": report(zs, fs, ys_te, gates, maha, "saposoa_peru_test"),
        "coleaf_deficiency_unseen": ood_report(zs, fs, zo_, fo_, gates, maha, "coleaf_deficiency_unseen"),
        "far_ood": far_ood(model, gates, maha),
        "onnx_parity_max_logit_diff": round(parity, 6),
    }

    (OUT / "chakra.onnx").write_bytes(onnx_path.read_bytes())
    (OUT / "ood.json").write_text(json.dumps({k: v.tolist() for k, v in maha.items()}))
    card = {
        "version": "3.0.0",
        "model": "mobilenetv3_small_100 (timm, ImageNet init) fine-tuned on BRACOL leaf + local Saposoa (Peru) leaves (1/3 of each local class)",
        "format": "ONNX opset 17, fp32", "size_mb": round(onnx_path.stat().st_size / 1e6, 2),
        "input": "image: float32 RGB [0,1] NCHW 1x3x224x224, squash-resized whole photo; normalization in-graph",
        "outputs": {"logits": "[1,6]", "features": "[1,1024] penultimate, used by the Mahalanobis gate (ood.json)"},
        "classes": CLASSES, "gates": gates,
        "decision_rule": "abstain if energy > energy_threshold OR mahalanobis > mahalanobis_threshold OR conformal set size != 1",
        "metrics": metrics,
        "split_sizes": {"bracol": {k: len(v) for k, v in parts.items()}, "saposoa": {k: len(v) for k, v in sap.items()},
                        "local_oversample": LOCAL_OVERSAMPLE},
        "training": {"epochs": EPOCHS, "best_val_acc": round(best, 4), "seconds": round(time.time() - t0), "device": "CPU"},
        "quantization": "Static int8 QDQ (full and conv-only) evaluated in v1: top-1 fell to 34%/30% on BRACOL test, so fp32 ships.",
        "data": {
            "train": "BRACOL leaf (Esgario, Krohling & Ventura 2020; Mendeley yy2k5y8mxg v1, CC BY 4.0). 1,401 of 1,747 images recovered from a truncated archive; class 5 excluded.",
            "local": "Saposoa, San Martin, Peru (Santa-Maria & Rodriguez 2026; Mendeley mfpxg4y65r v1, CC BY 4.0). healthy 60 / rust 145 / ojo de gallo 121 images, SHA-256 verified at download: 1/3 train / 1/6 calib / rest test per class.",
            "unseen": "CoLeaf-DB (Jaen, Cajamarca, Peru; Mendeley brfgw46wzb v1, CC BY 4.0): iron and nitrogen deficiency leaves, used ONLY to test abstention.",
        },
        "not_covered": ["ojo de gallo is learned from only 40 local leaves (Saposoa, one site); treat as provisional",
                        "nutrient deficiencies (N, Fe, K, ...) - never trained; model should abstain",
                        "coffee berry borer (broca) and any berry/stem/root symptom",
                        "upper leaf surface (BRACOL photographs the underside)",
                        "leaves photographed on the plant against cluttered backgrounds",
                        "Peruvian leaf miner, phoma and cercospora (learned only from Brazilian BRACOL photos)",
                        "multiple simultaneous stresses",
                        "night/flash photos, very low-end cameras"],
        "citations": ["Liu et al. 2020 Energy-based OOD detection, NeurIPS", "Lee et al. 2018 Mahalanobis OOD, NeurIPS",
                      "Angelopoulos & Bates 2021 arXiv:2107.07511", "Guo et al. 2017 On calibration, ICML"],
    }
    (OUT / "model_card.json").write_text(json.dumps(card, indent=2, default=str))
    print(json.dumps({k: metrics[k] for k in ("saposoa_test", "coleaf_deficiency_unseen", "far_ood")}, indent=1))


if __name__ == "__main__":
    main()
