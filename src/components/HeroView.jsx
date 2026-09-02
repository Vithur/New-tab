import React from 'react'

const HeroView = ({ shortcuts = [], onStart, isVisible = true, mirrored = false }) => {
  return (
    <div className='absolute inset-0 pointer-events-none z-40'>
      {/* Vertical Dock of Quick Shortcuts */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 flex flex-col gap-3.5 pointer-events-auto z-40 awwwards-motion ${
          mirrored ? 'left-8' : 'right-8'
        } ${
          isVisible ? 'translate-x-0 opacity-100 scale-100' : mirrored ? '-translate-x-16 opacity-0 scale-90' : 'translate-x-16 opacity-0 scale-90'
        }`}
      >
{shortcuts
            .filter((s) => s && typeof s.url === 'string' && s.url.trim())
            .slice(0, 6)
            .map((s) => (
              <a
                key={s.id || s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className='figma-glass-card h-[6.5vh] w-[6.5vh] min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-white cursor-pointer transition-all'
                title={s.title || s.url}
              >
              {s.iconDataUrl || s.iconUrl ? (
                <img src={s.iconDataUrl || s.iconUrl} alt={s.title || ''} className='h-[3vh] w-[3vh] min-h-[20px] min-w-[20px] object-contain relative z-10' />
              ) : s.iconClass ? (
                <i className={`${s.iconClass} text-[2.8vh] text-white relative z-10`}></i>
              ) : (
                <i className='ri-link text-[2.8vh] text-white relative z-10'></i>
              )}
            </a>
          ))}
      </div>

      {/* START Button (Highest Z-Index) */}
      <div
        className={`absolute bottom-10 pointer-events-auto z-50 awwwards-motion ${
          mirrored ? 'left-10' : 'right-10'
        } ${
          isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-90'
        }`}
      >
        <button
          type='button'
          onClick={onStart}
          className='figma-glass-card px-15 py-3 rounded-full text-white font-gilroy-bold text-sm tracking-wider flex items-center gap-2 cursor-pointer transition-all relative z-50 shadow-2xl'
        >
          {mirrored && <i className='ri-arrow-left-s-line text-lg relative z-10'></i>}
          <span className='relative z-10 uppercase'>start</span>
          {!mirrored && <i className='ri-arrow-right-s-line text-lg relative z-10'></i>}
        </button>
      </div>
    </div>
  )
}

export default HeroView
