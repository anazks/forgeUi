import React from 'react';

const ForgeLoader: React.FC = () => {
  const text = "FORGE";
  const dots = ["·", "·", "·"];

  return (
    <div className="forge-loader-overlay">
      <div className="forge-wavy-container">
        {text.split("").map((char, index) => (
          <span 
            key={index} 
            className="wavy-char" 
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {char}
          </span>
        ))}
        {dots.map((dot, index) => (
          <span 
            key={`dot-${index}`} 
            className="wavy-dot" 
            style={{ animationDelay: `${(text.length + index) * 0.1}s` }}
          >
            {dot}
          </span>
        ))}
      </div>

      <style>{`
        .forge-loader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--bg-main);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(8px);
        }

        .forge-wavy-container {
          display: flex;
          align-items: flex-end;
          gap: 2px;
        }

        .wavy-char, .wavy-dot {
          font-size: 2rem;
          font-weight: 900;
          color: var(--primary);
          font-family: 'Outfit', sans-serif;
          display: inline-block;
          animation: forge-wave 1.2s ease-in-out infinite;
          letter-spacing: 2px;
        }

        .wavy-dot {
          font-size: 2.5rem;
          line-height: 1;
          color: var(--primary);
          margin-bottom: 2px;
        }

        @keyframes forge-wave {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.5;
            filter: blur(0);
          }
          50% {
            transform: translateY(-15px);
            opacity: 1;
            filter: drop-shadow(0 0 8px var(--primary));
          }
        }
      `}</style>
    </div>
  );
};

export default ForgeLoader;
