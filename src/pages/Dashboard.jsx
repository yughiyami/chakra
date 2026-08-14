import React from 'react';
import { Award, Target, ShieldCheck, Home as HomeIcon, LayoutDashboard, Utensils, BedDouble, Bath } from 'lucide-react';

export default function Dashboard({ level, progress, spaces }) {
  const rooms = [
    { id: 1, name: 'Sala Principal', icon: LayoutDashboard, status: 'safe', score: '85%' },
    { id: 2, name: 'Cocina', icon: Utensils, status: 'warning', score: '60%' },
    { id: 3, name: 'Habitación', icon: BedDouble, status: 'safe', score: '92%' },
    { id: 4, name: 'Baño', icon: Bath, status: 'pending', score: '--' },
  ];

  return (
    <div className="dashboard">
      <header className="mb-8">
        <h1 className="font-semibold">Resilia</h1>
        <p>Tu hogar está cada vez más preparado.</p>
      </header>
      
      <section className="card mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div style={{background: 'var(--primary)', padding: '0.5rem', borderRadius: 'var(--radius)'}}>
              <Award style={{color: 'var(--primary-foreground)'}} size={24} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{marginBottom: 0}}>Nivel {level}</h2>
              <p className="text-xs" style={{margin: 0}}>Preparación Sísmica</p>
            </div>
          </div>
          <span className="font-semibold">{progress}%</span>
        </div>
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      </section>
      
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold m-0">Instancias del Hogar</h2>
          <button className="btn btn-outline text-xs" style={{padding: '0.25rem 0.75rem'}}>+ Agregar</button>
        </div>
        
        <div className="grid-cols-2">
          {rooms.map(room => (
            <div key={room.id} className="card card-hover flex flex-col gap-3" style={{padding: '1rem'}}>
              <div className="flex justify-between items-start">
                <room.icon size={20} color="var(--muted-foreground)" />
                {room.status === 'safe' && <div className="badge safe text-xs">Seguro</div>}
                {room.status === 'warning' && <div className="badge warning text-xs">Alerta</div>}
                {room.status === 'pending' && <div className="badge default text-xs">Pendiente</div>}
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{margin: 0}}>{room.name}</h3>
                <p className="text-xs" style={{margin: 0}}>Score: {room.score}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      
      <section>
        <h2 className="text-sm font-semibold mb-4">Métricas Globales</h2>
        
        <div className="flex flex-col gap-3">
          <div className="card flex items-center gap-4" style={{padding: '1rem'}}>
            <div style={{background: 'var(--muted)', padding: '0.75rem', borderRadius: '50%'}}>
              <Target size={20} style={{color: 'var(--muted-foreground)'}} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{margin: 0}}>{spaces} Espacios Analizados</h3>
              <p className="text-xs" style={{margin: 0}}>En la configuración de tu hogar</p>
            </div>
          </div>
          
          <div className="card flex items-center gap-4" style={{padding: '1rem'}}>
            <div style={{background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '50%'}}>
              <ShieldCheck size={20} style={{color: 'var(--success)'}} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{margin: 0}}>12 Zonas Seguras</h3>
              <p className="text-xs" style={{margin: 0}}>Identificadas y validadas por INDECI</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
