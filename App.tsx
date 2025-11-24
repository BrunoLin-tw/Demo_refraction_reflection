import React, { useState } from 'react';
import OpticsCanvas from './components/OpticsCanvas';

function App() {
  const [ior, setIor] = useState<number>(1.50);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      {/* Background / Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <OpticsCanvas prismIOR={ior} />
      </div>

      {/* Overlay UI Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8">
        
        {/* Header */}
        <div className="text-white/50 text-sm tracking-[0.5em] uppercase text-center md:text-left">
          光学实验室
        </div>

        {/* Title & instructions centered (fades out optionally, but keeping it static for cool factor) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-30 mix-blend-screen">
           <h1 className="text-6xl md:text-9xl font-bold tracking-tighter text-white mb-4 blur-[1px]">
             棱镜
           </h1>
        </div>

        {/* Bottom Controls */}
        <div className="pointer-events-auto w-full max-w-md mx-auto md:mx-0 bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl transition-opacity hover:bg-black/60">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center text-white">
              <label htmlFor="ior" className="text-xs uppercase tracking-widest text-gray-400">
                折射率 (n)
              </label>
              <span className="font-mono text-cyan-400 font-bold text-lg">{ior.toFixed(2)}</span>
            </div>
            
            <input
              id="ior"
              type="range"
              min="1.0"
              max="2.5"
              step="0.01"
              value={ior}
              onChange={(e) => setIor(parseFloat(e.target.value))}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            
            <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider pt-1">
              <span>空气 (1.0)</span>
              <span>玻璃 (1.5)</span>
              <span>钻石 (2.4)</span>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 text-[10px] text-gray-500 leading-relaxed">
              <p>
                <strong className="text-gray-300">操作说明：</strong> 拖动 <span className="text-white">光源</span> 移动位置。
                拖动 <span className="text-white">棱镜中心</span> 平移位置。
                拖动 <span className="text-white">棱镜主体</span> 进行旋转。
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;