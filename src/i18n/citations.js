// Bibliographic references (language-independent).
export const CITATIONS = [
  'Esgario, Krohling & Ventura (2020). Deep learning for classification and severity estimation of coffee leaf biotic stress. Computers and Electronics in Agriculture 169. Dataset BRACOL, CC BY 4.0.',
  'Santa-María & Rodríguez (2026). Coffee leaf images from Saposoa, San Martín, Peru. Mendeley Data mfpxg4y65r, CC BY 4.0.',
  'Motisi et al. (2022). Monthly rust classes (ExpeRoya). Agricultural Systems.',
  'Moraes et al. (1976), as reported in Alfonsi et al. (2019). Coffee rust incubation period models. Pesquisa Agropecuária Brasileira.',
  'Avelino et al. (2007). Topography and crop management are key factors for the development of American leaf spot epidemics on coffee in Costa Rica. Phytopathology 97:1532–1542.',
  'Avelino et al. (2015). The coffee rust crises in Colombia and Central America (2008–2013). Food Security 7.',
  'Jaramillo et al. (2009). Thermal tolerance of the coffee berry borer Hypothenemus hampei. PLoS ONE 4(8).',
  'Hamilton et al. (2019). Coffee berry borer degree-day model and field validation. PLoS ONE.',
  'Sentelhas et al. (2008). Leaf wetness and agrometeorological models for plant disease.',
  'Liu, Wang, Owens & Li (2020). Energy-based out-of-distribution detection. NeurIPS.',
  'Lee, Lee, Lee & Shin (2018). A simple unified framework for detecting out-of-distribution samples (Mahalanobis). NeurIPS.',
  'Angelopoulos & Bates (2021). A gentle introduction to conformal prediction and distribution-free uncertainty quantification. arXiv:2107.07511.',
  'Guo, Pleiss, Sun & Weinberger (2017). On calibration of modern neural networks (temperature scaling). ICML.',
]

export const DATASETS = [
  { name: 'BRACOL (coffee leaf, Brazil)', use: 'Model training / test', license: 'CC BY 4.0' },
  { name: 'Saposoa leaves (San Martín, Peru)', use: 'Local adaptation + Peru test', license: 'CC BY 4.0' },
  { name: 'CoLeaf-DB (nutrient-deficiency leaves, Jaén, Peru)', use: 'Never-seen abstention test', license: 'See dataset terms' },
  { name: 'Open-Meteo (ERA5 archive + forecast)', use: 'Weather rules', license: 'CC BY 4.0' },
  { name: 'World Bank Commodity Prices (Pink Sheet)', use: 'International Arabica price', license: 'CC BY 4.0' },
  { name: 'FAOSTAT Producer Prices (Peru)', use: 'Farmgate pass-through band', license: 'CC BY 4.0' },
  { name: 'open.er-api.com', use: 'USD→PEN exchange rate (optional, online)', license: 'Free, attribution' },
]
