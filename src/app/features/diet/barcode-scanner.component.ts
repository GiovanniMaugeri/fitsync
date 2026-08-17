import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';

type CameraErrorKind = 'denied' | 'unavailable';

/**
 * Possiede l'intero ciclo di vita della fotocamera e la decodifica del barcode.
 * Usa la Barcode Detection API nativa dove disponibile; altrimenti carica
 * @zxing/browser via import() dinamico solo sui browser senza supporto nativo
 * (tipicamente Safari/iOS), per non appesantire il bundle principale.
 */
@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="scanner-wrap">
      <video #videoEl class="scanner-video" autoplay muted playsinline></video>
      <div class="scanner-frame"></div>
      <button class="scanner-cancel" (click)="cancel()">
        <lucide-icon [img]="X" size="20"></lucide-icon>
        Annulla
      </button>
    </div>
  `,
  styles: [`
    .scanner-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
    }
    .scanner-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .scanner-frame {
      position: absolute;
      inset: 20% 10%;
      border: 2px solid rgba(255, 255, 255, 0.85);
      border-radius: 8px;
      pointer-events: none;
    }
    .scanner-cancel {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 999px;
      border: none;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      cursor: pointer;
    }
  `]
})
export class BarcodeScannerComponent implements OnInit, OnDestroy {
  @Output() detected = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() cameraError = new EventEmitter<CameraErrorKind>();

  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;

  readonly X = X;

  private mediaStream: MediaStream | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private zxingControls: { stop: () => void } | null = null;
  private stopped = false;

  async ngOnInit() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (err: any) {
      this.cameraError.emit(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      return;
    }

    if (this.stopped) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    this.mediaStream = stream;
    const video = this.videoRef.nativeElement;
    video.srcObject = stream;
    await video.play().catch(() => {});

    if ('BarcodeDetector' in window) {
      this.startNativeDetection(video);
    } else {
      await this.startZXingFallback(video);
    }
  }

  private startNativeDetection(video: HTMLVideoElement) {
    const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'upc_a'] });
    this.pollIntervalId = setInterval(async () => {
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0) {
          this.onDetected(codes[0].rawValue);
        }
      } catch {
        // frame non decodificabile, si continua a provare
      }
    }, 300);
  }

  private async startZXingFallback(video: HTMLVideoElement) {
    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library')
    ]);

    if (this.stopped) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 300 });

    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (result) {
        this.onDetected(result.getText());
      }
    });

    if (this.stopped) {
      controls.stop();
      return;
    }
    this.zxingControls = controls;
  }

  private onDetected(barcode: string) {
    if (this.stopped) return;
    this.stopCamera();
    this.detected.emit(barcode);
  }

  cancel() {
    this.stopCamera();
    this.cancelled.emit();
  }

  private stopCamera(): void {
    this.stopped = true;
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    if (this.zxingControls) {
      this.zxingControls.stop();
      this.zxingControls = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
