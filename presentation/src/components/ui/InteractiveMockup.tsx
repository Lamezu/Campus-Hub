import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor } from 'lucide-react';
import type { GalleryImage } from '../../types';

interface InteractiveMockupProps {
  type: 'mobile' | 'web' | 'desktop';
  images: GalleryImage[];
  isActive?: boolean;
}

export default function InteractiveMockup({ type, images, isActive }: InteractiveMockupProps) {
  const [isAwake, setIsAwake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number>(type === 'mobile' ? 9/19.5 : (type === 'web' ? 16/9 : 16/10));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) {
      setIsAwake(false);
      setIsLoading(false);
      setCurrentIndex(0);
    }
  }, [isActive]);

  useEffect(() => {
    setAspectRatio(type === 'mobile' ? 9/19.5 : (type === 'web' ? 16/9 : 16/10));
  }, [currentIndex, type]);

  useEffect(() => {
    if (isAwake && containerRef.current && !isLoading) {
      containerRef.current.focus();
    }
  }, [isAwake, isLoading]);

  const handleMediaLoad = (width: number, height: number) => {
    if (width && height) {
      setAspectRatio(width / height);
    }
  };

  const triggerLoad = (callback?: () => void) => {
    setIsLoading(true);
    const duration = type === 'mobile' ? 3500 : (type === 'web' ? 1500 : 4000);
    setTimeout(() => {
      setIsLoading(false);
      if (callback) callback();
    }, duration);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isAwake || isLoading) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      if (currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsAwake(false);
      setIsLoading(false);
      setCurrentIndex(0);
    }
  };

  const handleVideoEnd = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBlur = () => {
    setIsAwake(false);
    setIsLoading(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAwake) {
      setIsAwake(true);
      triggerLoad(() => setCurrentIndex(0));
    }
  };

  const currentImage = images[currentIndex] || images[0];

  const renderBootScreen = () => {
    if (type === 'mobile') {
      return (
        <motion.div
          key="mobile-boot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: '3rem' }}
          >
            <svg width="60" height="74" viewBox="0 0 30 37" fill="#fff">
              <path d="M26.285 15.344c-.035-3.951 3.23-5.852 3.377-5.945-1.834-2.684-4.686-3.051-5.696-3.093-2.42-.246-4.717 1.427-5.945 1.427-1.228 0-3.111-1.393-5.127-1.353-2.648.04-5.084 1.543-6.446 3.914-2.75 4.793-.703 11.896 1.957 15.74 1.302 1.88 2.854 3.993 4.881 3.916 1.954-.078 2.691-1.265 5.048-1.265s3.02 1.265 5.088 1.226c2.1-.04 3.456-1.916 4.739-3.794 1.482-2.169 2.091-4.269 2.124-4.378-.045-.02-4.085-1.564-4.128-6.188zM20.57 4.145c1.087-1.317 1.821-3.149 1.621-4.978-1.57.063-3.472 1.045-4.598 2.361-1.01 1.171-1.892 3.053-1.654 4.832 1.75.136 3.544-.9 4.631-2.215z" />
            </svg>
          </motion.div>
          <div style={{ width: 180, height: 4, position: 'relative', marginTop: '2rem' }}>
            <svg width="180" height="4" viewBox="0 0 180 4">
              <rect width="180" height="2" y="1" fill="rgba(255,255,255,0.2)" />
              <rect height="4" fill="#ffffff" style={{ animation: 'mobile_svg_load 3.2s linear forwards' }} />
            </svg>
          </div>
          <style>{`
            @keyframes mobile_svg_load { 0% { width: 0; } 100% { width: 180px; } }
          `}</style>
        </motion.div>
      );
    }

    if (type === 'web') {
      return (
        <motion.div
          key="web-boot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ width: '100%', height: '100%', background: '#F8F9FA', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ position: 'absolute', top: 20, left: 20, right: 20, opacity: 0.05, pointerEvents: 'none' }}>
            <div style={{ height: 20, width: '40%', background: '#000', marginBottom: 20, borderRadius: 4 }} />
            <div style={{ height: 120, width: '100%', background: '#000', marginBottom: 20, borderRadius: 8 }} />
          </div>

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: '#fff', padding: '2rem 3rem', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', zIndex: 5, border: '1px solid #eee'
            }}
          >
            <div style={{ width: 40, height: 40 }}>
              <svg viewBox="0 0 50 50" style={{ animation: 'spin_web_load 1.2s linear infinite' }}>
                <circle cx="25" cy="25" r="20" fill="none" stroke="#F1F1F1" strokeWidth="4" />
                <circle cx="25" cy="25" r="20" fill="none" stroke="#E87C1E" strokeWidth="4" strokeDasharray="31.4 31.4" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Cargando CampusHub...</div>
          </motion.div>
          <style>{`
            @keyframes spin_web_load { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </motion.div>
      );
    }

    if (type === 'desktop') {
      return (
        <motion.div
          key="desktop-boot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            style={{ marginBottom: '4rem' }}
          >
            <svg width="120" height="120" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M0 3.449L9.75 2.1V11.25H0V3.449ZM0 12.75H9.75V21.9L0 20.551V12.75ZM11.25 1.889L24 0V11.25H11.25V1.889ZM11.25 12.75H24V24L11.25 22.111V12.75Z" />
            </svg>
          </motion.div>

          <div style={{ width: 40, height: 40, position: 'relative' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" style={{ animation: 'spin_win 4s linear infinite' }}>
              {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                <circle 
                  key={i} cx="20" cy="4" r="2" fill="#ffffff" 
                  style={{ 
                    transformOrigin: '20px 20px', 
                    transform: `rotate(${deg}deg)`,
                    animation: 'dot_pulse 4s ease-in-out infinite',
                    animationDelay: `${i * 0.1}s`
                  }} 
                />
              ))}
            </svg>
          </div>

          <style>{`
            @keyframes spin_win { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes dot_pulse { 
              0%, 100% { opacity: 0; transform: scale(0.5); }
              30%, 70% { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </motion.div>
      );
    }
    return null;
  };

  const renderContent = () => {
    if (isLoading) return renderBootScreen();

    if (isAwake) {
      const isVideo = currentImage.src?.toLowerCase().endsWith('.mp4');
      
      return (
        <motion.div
          key={currentImage.id}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          style={{ width: '100%', height: '100%', overflow: 'hidden' }}
        >
          {isVideo ? (
            <video 
              src={currentImage.src} 
              autoPlay muted playsInline 
              onEnded={handleVideoEnd}
              onLoadedMetadata={(e) => handleMediaLoad(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
              style={{ 
                width: '100%', height: '100%', 
                objectFit: 'cover', 
                background: '#000', 
                display: 'block'
              }} 
            />
          ) : (
            <img 
              src={currentImage.src} alt={currentImage.title} 
              onLoad={(e) => handleMediaLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
              style={{ 
                width: '100%', height: '100%', 
                objectFit: 'cover', 
                background: '#000', 
                display: 'block' 
              }} 
            />
          )}
        </motion.div>
      );
    }

    return (
      <motion.div
        key="sleep"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          width: '100%', height: '100%', background: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <div style={{
          fontSize: '0.85rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.15em', textTransform: 'uppercase',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem'
        }}>
          <Monitor size={32} strokeWidth={1} style={{ opacity: 0.15 }} />
          <span>Click para despertar</span>
        </div>
      </motion.div>
    );
  };

  const renderPagination = () => {
    if (!isAwake || images.length <= 1 || isLoading) return null;
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ 
          marginTop: '2rem', 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '12px',
          width: '100%'
        }}
      >
        {images.map((_, idx) => (
          <div key={idx} style={{
            width: idx === currentIndex ? 24 : 10, 
            height: 10, 
            borderRadius: 5,
            background: idx === currentIndex ? '#E87C1E' : 'rgba(255,255,255,0.15)',
            boxShadow: idx === currentIndex ? '0 0 15px rgba(232,124,30,0.4)' : 'none',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: 'pointer'
          }} onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }} />
        ))}
      </motion.div>
    );
  };

  const renderFrame = () => {
    if (type === 'mobile') {
      return (
        <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'visible' }}>
          <div className="phone-frame" style={{
            borderRadius: '3.5rem', border: '8px solid #1a1a1a', background: '#000', padding: '2px',
            boxShadow: isAwake ? '0 50px 120px rgba(0,0,0,0.9), 0 0 60px rgba(232,124,30,0.08)' : '0 20px 60px rgba(0,0,0,0.6)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)', width: '100%', aspectRatio: '9 / 19.5', position: 'relative',
            outline: '1px solid rgba(255,255,255,0.05)', outlineOffset: '-1px', overflow: 'visible'
          }}>
            {/* Side Buttons Hardware */}
            <div style={{ position: 'absolute', right: '-11px', top: '25%', width: '3px', height: '12%', background: '#333', border: '1px solid #444', borderRadius: '0 4px 4px 0' }} />
            <div style={{ position: 'absolute', left: '-11px', top: '20%', width: '3px', height: '8%', background: '#333', border: '1px solid #444', borderRadius: '4px 0 0 4px' }} />
            <div style={{ position: 'absolute', left: '-11px', top: '30%', width: '3px', height: '8%', background: '#333', border: '1px solid #444', borderRadius: '4px 0 0 4px' }} />

            {/* Dynamic Island / Notch */}
            <div style={{ position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', width: '80px', height: '24px', background: '#000', borderRadius: '12px', zIndex: 100, border: '1px solid rgba(255,255,255,0.05)' }} />
            
            <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '2.8rem', overflow: 'hidden', background: '#000' }}>
              <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2.8rem', pointerEvents: 'none', zIndex: 20 }} />
              <AnimatePresence mode="wait">
                {renderContent()}
              </AnimatePresence>
            </div>
          </div>
          {renderPagination()}
        </div>
      );
    }

    if (type === 'web') {
      return (
        <div style={{ width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            borderRadius: '1rem', overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: isAwake ? '0 60px 140px rgba(0,0,0,1), 0 0 80px rgba(255,165,0,0.1)' : '0 30px 80px rgba(0,0,0,0.7)',
            transition: 'all 0.6s cubic-bezier(1, 1, 0.3, 1)', width: '100%', height: 'auto'
          }}>
            <div style={{ height: 42, background: '#1F1F1F', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', padding: '0 1.2rem', gap: '0.8rem' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
                  <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
                ))}
              </div>
              <div style={{ flex: 1, marginLeft: '1.5rem', height: 28, borderRadius: 6, background: '#121212', display: 'flex', alignItems: 'center', padding: '0 1.2rem', border: '1px solid #333' }}>
                <span style={{ fontSize: '0.75rem', color: '#888', letterSpacing: '0.02em' }}>campus-hub.web.app</span>
              </div>
            </div>
            <div style={{ 
              position: 'relative', 
              overflow: 'hidden', 
              width: '100%', 
              height: 0,
              paddingBottom: `calc((100% / ${aspectRatio}) - 40px)`,
              background: '#fff' 
            }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <AnimatePresence mode="wait">
                  {renderContent()}
                </AnimatePresence>
              </div>
            </div>
          </div>
          {renderPagination()}
        </div>
      );
    }

    if (type === 'desktop') {
      return (
        <div style={{ width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            borderRadius: '0.75rem', overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: isAwake ? '0 70px 160px rgba(0,0,0,1), 0 0 100px rgba(255,165,0,0.12)' : '0 35px 100px rgba(0,0,0,0.8)',
            transition: 'all 0.6s cubic-bezier(1, 1, 0.3, 1)', width: '100%', aspectRatio: aspectRatio,
            position: 'relative'
          }}>
            <div style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', background: '#000' }}>
              <AnimatePresence mode="wait">
                {renderContent()}
              </AnimatePresence>
            </div>

            {/* Windows 11 Style Taskbar - Super Slim Integration */}
            {isAwake && !isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, 
                  width: '100%', height: '32px',
                  background: '#000',
                  display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: '4px', zIndex: 100
                }}
              >
                {/* Start Button */}
                <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#00a4ef">
                    <path d="M0 3.449L9.75 2.1V11.25H0V3.449ZM0 12.75H9.75V21.9L0 20.551V12.75ZM11.25 1.889L24 0V11.25H11.25V1.889ZM11.25 12.75H24V24L11.25 22.111V12.75Z" />
                  </svg>
                </div>

                {/* Search Icon */}
                <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>

                {/* Apps Group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: 6 }}>
                  {[
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffbd2e"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="#27c93f"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> },
                    { 
                      icon: (
                        <div style={{ width: 22, height: 22, background: 'linear-gradient(45deg, #E87C1E, #ff9d47)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        </div>
                      ),
                      active: true
                    }
                  ].map((app, i) => (
                    <div key={i} style={{ 
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, cursor: 'pointer',
                      position: 'relative'
                    }}>
                      {app.icon}
                      {app.active && (
                        <div style={{ position: 'absolute', bottom: 1, width: 3, height: 1.5, background: '#E87C1E', borderRadius: 1 }} />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
          {renderPagination()}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onClick={handleClick}
      style={{
        outline: 'none',
        cursor: isAwake ? 'default' : "url('/assets/custom_pointer.png') 16 0, pointer",
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: type === 'mobile' ? 400 : 1150,
        margin: '0 auto'
      }}
    >
      {renderFrame()}
    </div>
  );
}
