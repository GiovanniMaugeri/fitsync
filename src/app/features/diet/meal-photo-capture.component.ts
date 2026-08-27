import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { LucideAngularModule, Camera, RotateCcw } from 'lucide-angular';

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.72;

/**
 * Cattura una singola foto del piatto (via input file nativo, non getUserMedia:
 * qui basta uno scatto, non un loop di detection continuo come per il barcode).
 * Ridimensiona lato client prima di emettere, per contenere payload/latenza/token AI.
 */
@Component({
  selector: 'app-meal-photo-capture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="photo-capture-wrap">
      @if (!previewUrl) {
        <button class="capture-btn" (click)="fileInput.click()">
          <lucide-icon [img]="Camera" size="28"></lucide-icon>
          <span>Scatta o carica una foto del piatto</span>
        </button>
      } @else {
        <img [src]="previewUrl" class="photo-preview" alt="Anteprima piatto" />
        <div class="preview-actions">
          <button class="btn btn-outline" (click)="reset()">
            <lucide-icon [img]="RotateCcw" size="16"></lucide-icon> Cambia foto
          </button>
          <button class="btn btn-primary" (click)="confirm()">Analizza piatto</button>
        </div>
      }
      <input #fileInput type="file" accept="image/*" capture="environment" class="hidden-input" (change)="onFileSelected($event)" />
    </div>
  `,
  styles: [`
    .photo-capture-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .hidden-input {
      display: none;
    }
    .capture-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px dashed rgba(255, 255, 255, 0.2);
      color: #a1a1aa;
      border-radius: 12px;
      padding: 2.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(6, 182, 212, 0.1);
        border-color: rgba(6, 182, 212, 0.4);
        color: var(--primary-cyan, #06b6d4);
      }
    }
    .photo-preview {
      width: 100%;
      max-height: 320px;
      object-fit: contain;
      border-radius: 12px;
      background: #000;
    }
    .preview-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
  `]
})
export class MealPhotoCaptureComponent {
  @Output() photoReady = new EventEmitter<{ base64: string; mimeType: string }>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  readonly Camera = Camera;
  readonly RotateCcw = RotateCcw;

  previewUrl: string | null = null;
  private pendingBase64: string | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const resized = await this.resizeToJpeg(file);
    this.pendingBase64 = resized;
    this.previewUrl = `data:image/jpeg;base64,${resized}`;
    input.value = '';
    this.cdr.markForCheck();
  }

  private resizeToJpeg(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas context non disponibile'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('immagine non decodificabile'));
      };
      img.src = objectUrl;
    });
  }

  reset() {
    this.previewUrl = null;
    this.pendingBase64 = null;
  }

  confirm() {
    if (!this.pendingBase64) return;
    this.photoReady.emit({ base64: this.pendingBase64, mimeType: 'image/jpeg' });
  }
}
