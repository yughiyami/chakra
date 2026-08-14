import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

export default function Analyze({ onAnalyzeComplete }) {
  const [status, setStatus] = useState('idle'); // idle, uploading, analyzing, complete

  const handleUpload = () => {
    setStatus('uploading');
    
    // Simulate upload delay
    setTimeout(() => {
      setStatus('analyzing');
      // Simulate analysis delay
      setTimeout(() => {
        setStatus('complete');
        onAnalyzeComplete();
      }, 2000);
    }, 1000);
  };

  if (status === 'complete') {
    return (
      <div className="analyze-results">
        <header className="mb-6">
          <h2 className="text-sm font-semibold">Análisis Completado</h2>
          <p className="text-xs">Mapeo estructural y validación de reglas finalizada.</p>
        </header>

        <section className="card mb-4 border-l-4" style={{borderLeftColor: 'var(--destructive)'}}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} color="var(--destructive)" />
            <h3 className="text-sm font-semibold m-0">Riesgo Estructural</h3>
          </div>
          <p className="text-xs mb-3">Estante alto detectado cerca de la cama (Profundidad relativa: 0.82). Riesgo de obstrucción en ruta de escape.</p>
          <div className="badge warning">Requiere Acción</div>
        </section>

        <section className="card mb-8 border-l-4" style={{borderLeftColor: 'var(--success)'}}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} color="var(--success)" />
            <h3 className="text-sm font-semibold m-0">Zona de Seguridad Interna</h3>
          </div>
          <p className="text-xs mb-3">Espacio despejado detectado en intersección de vigas principales. Recomendado por E.030.</p>
          <div className="badge safe">Zona Verificada</div>
        </section>

        <button className="btn btn-primary w-full" onClick={() => setStatus('idle')}>
          Analizar nuevo espacio
        </button>
      </div>
    );
  }

  return (
    <div className="analyze flex flex-col justify-center" style={{minHeight: '70vh'}}>
      <div className="text-center mb-8">
        <h2 className="font-semibold">Auditoría Visual</h2>
        <p>Captura o sube una imagen de tu habitación para ejecutar el mapeo de riesgos.</p>
      </div>
      
      {status === 'idle' && (
        <div className="uploader-zone" onClick={handleUpload}>
          <UploadCloud size={40} className="uploader-icon mx-auto" />
          <h3 className="text-sm font-semibold">Seleccionar Imagen</h3>
          <p className="text-xs mt-2">Formatos soportados: JPG, PNG (Max 5MB)</p>
        </div>
      )}

      {(status === 'uploading' || status === 'analyzing') && (
        <div className="text-center">
          <div className="loader mb-4" style={{
            border: '3px solid var(--secondary)',
            borderTop: '3px solid var(--primary)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h3 className="text-sm font-semibold">
            {status === 'uploading' ? 'Cargando imagen al servidor...' : 'Ejecutando pipeline de percepción...'}
          </h3>
          <p className="text-xs mt-2">
            {status === 'analyzing' ? 'Validando topología y motor de reglas' : 'Procesando archivo'}
          </p>
        </div>
      )}
    </div>
  );
}
