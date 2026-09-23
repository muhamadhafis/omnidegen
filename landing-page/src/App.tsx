import { Button } from '@/components/ui/button';
import GradientWaves from './components/GradientWaves';

function TelegramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.161c-.18 1.897-.96 6.502-1.36 8.627-.17.9-.5 1.201-.82 1.23-.697.065-1.226-.46-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export default function App() {
  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-white flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-[#4389e6] selection:text-white">

      {/* Dynamic Animated GradientWaves Background (Blue Theme) */}
      <div className="absolute inset-0 z-0">
        <GradientWaves
          horizonColor="#172554"
          waveColor="#4389e6"
          crestColor="#93c5fd"
          speed={0.35}
          amplitude={2.2}
          waveScale={0.65}
          waveRatio={0.85}
          swell={25}
          turbulence={15}
          tilt={1.05}
          zoom={1.0}
          height={5.0}
          fogDepth={18}
          detail="medium"
          brightness={1.0}
          opacity={0.85}
          mouseInteraction={true}
          parallaxStrength={0.4}
          grain={true}
          grainIntensity={0.03}
        />
      </div>

      {/* Main Single-Screen Content Container (Header + Button) */}
      <main className="relative z-10 max-w-2xl w-full text-center space-y-8 flex flex-col items-center">

        {/* Clean Header Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-7xl font-semibold tracking-tight text-white">
            Eksekusi DeFi <br/> Secara Otomatis
          </h1>

          <p className="text-sm sm:text-base text-blue-100/90 max-w-[48ch] mx-auto leading-relaxed font-normal">
            Atur strategi SL, TP dan Swap secara otomatis dengan pesan teks biasa di Telegram.
          </p>
        </div>

        {/* Middle Primary Action Button */}
        <div className="pt-2">
          <a
            href="https://t.me/Omnidegen_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <Button
              size="lg"
              className="h-12 px-12 rounded-2xl bg-[#4389e6] hover:bg-[#3575c9] active:bg-[#2b62ab] text-white font-semibold text-base border border-white/20 transition-colors duration-150 cursor-pointer flex items-center gap-3"
            >
              <TelegramIcon className="w-5 h-5 fill-current" />
              <span>Beri Intruksi Sekarang</span>
            </Button>
          </a>
        </div>

      </main>

    </div>
  );
}
