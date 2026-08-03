import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { 
  LucideAngularModule, 
  Flame, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Edit3, 
  Utensils, 
  Check, 
  X 
} from 'lucide-angular';
import { DietService } from '../../core/services/diet.service';
import { DietLog, DietMealDetail, DietLogItem } from '../../core/models/fitsync.models';

@Component({
  selector: 'app-diet-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule],
  template: `
    <div class="diet-log-container">
      
      <!-- DATE NAV HEADER -->
      <div class="date-nav-card">
        <button class="nav-arrow-btn" (click)="changeDate(-1)" title="Giorno precedente">
          <lucide-icon [img]="ChevronLeft" size="20"></lucide-icon>
        </button>
        
        <div class="date-display" (click)="setToday()">
          <lucide-icon [img]="Calendar" size="18" class="calendar-icon"></lucide-icon>
          <span class="date-text">{{ formattedDisplayDate }}</span>
          <span *ngIf="isToday" class="today-badge">Oggi</span>
        </div>

        <button class="nav-arrow-btn" (click)="changeDate(1)" title="Giorno successivo">
          <lucide-icon [img]="ChevronRight" size="20"></lucide-icon>
        </button>
      </div>

      <!-- DAILY CALORIES SUMMARY CARD -->
      <div class="calorie-summary-card" *ngIf="activeLog">
        <div class="card-header">
          <div class="summary-title">
            <span class="flame-icon"><lucide-icon [img]="Flame" size="22"></lucide-icon></span>
            <span>Calorie del Giorno</span>
          </div>

          <button class="target-edit-btn" (click)="toggleTargetEdit()" title="Modifica Obiettivo Calorie">
            <lucide-icon [img]="Edit3" size="16"></lucide-icon>
            <span>Target: {{ activeLog.target_calories || 2000 }} kcal</span>
          </button>
        </div>

        <!-- Inline edit target -->
        <div *ngIf="isEditingTarget" class="target-edit-form">
          <label>Obiettivo Calorie Giornaliere (kcal):</label>
          <div class="input-row">
            <input type="number" [(ngModel)]="tempTargetCalories" min="500" max="10000" class="form-input" />
            <button class="btn btn-sm btn-primary" (click)="saveTargetCalories()">Salva</button>
            <button class="btn btn-sm btn-outline" (click)="isEditingTarget = false">Annulla</button>
          </div>
        </div>

        <div class="calorie-stats">
          <div class="main-stat">
            <span class="consumed-value">{{ totalConsumedCalories }}</span>
            <span class="target-divider">/ {{ activeLog.target_calories || 2000 }}</span>
            <span class="unit">kcal</span>
          </div>
          
          <div class="remaining-badge" [class.over]="remainingCalories < 0">
            <span *ngIf="remainingCalories >= 0">Rimanenti: <strong>{{ remainingCalories }} kcal</strong></span>
            <span *ngIf="remainingCalories < 0">Superato di: <strong>{{ mathAbs(remainingCalories) }} kcal</strong></span>
          </div>
        </div>

        <!-- PROGRESS BAR -->
        <div class="progress-container">
          <div class="progress-fill" [style.width.%]="caloriePercentage" [class.over-fill]="remainingCalories < 0"></div>
        </div>
      </div>

      <!-- FLEXIBLE MEALS LIST -->
      <div class="meals-section" *ngIf="activeLog">
        <div class="section-header">
          <h2 class="section-title">I Tuoi Pasti</h2>
          <button class="btn btn-sm btn-outline btn-add-meal" (click)="openAddMealModal()">
            <lucide-icon [img]="Plus" size="16"></lucide-icon> Nuovo Pasto
          </button>
        </div>

        <!-- EMPTY MEALS STATE -->
        <div *ngIf="!activeLog.meals || activeLog.meals.length === 0" class="empty-meals-card">
          <lucide-icon [img]="Utensils" size="36" class="empty-meals-icon"></lucide-icon>
          <p class="empty-meals-text">Nessun pasto creato per questo giorno.</p>
          <button class="btn btn-sm btn-primary" (click)="openAddMealModal()">
            <lucide-icon [img]="Plus" size="16"></lucide-icon> Crea il Tuo Primo Pasto
          </button>
        </div>

        <!-- MEAL CARDS -->
        <div class="meal-card" *ngFor="let meal of activeLog.meals">
          <div class="meal-header">
            <div class="meal-title-group">
              <span class="meal-icon"><lucide-icon [img]="Utensils" size="18"></lucide-icon></span>
              <h3 class="meal-name">{{ meal.name }}</h3>
            </div>
            
            <div class="meal-header-right">
              <span class="meal-calories">{{ meal.total_calories }} kcal</span>
              <button class="delete-meal-btn" (click)="deleteMeal(meal)" title="Elimina pasto">
                <lucide-icon [img]="Trash2" size="16"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- FOOD ITEMS LIST -->
          <div class="food-items-list" *ngIf="meal.items && meal.items.length > 0">
            <div class="food-item-row" *ngFor="let item of meal.items">
              <div class="food-info">
                <span class="food-name">{{ item.name }}</span>
                <span *ngIf="item.amount_note" class="food-note">({{ item.amount_note }})</span>
              </div>
              <div class="food-right">
                <span class="food-calories">{{ item.calories }} kcal</span>
                <button class="delete-item-btn" (click)="deleteFoodItem(item)" title="Rimuovi cibo">
                  <lucide-icon [img]="Trash2" size="14"></lucide-icon>
                </button>
              </div>
            </div>
          </div>

          <div *ngIf="!meal.items || meal.items.length === 0" class="empty-meal-text">
            Nessun cibo aggiunto a questo pasto.
          </div>

          <!-- ADD FOOD BUTTON -->
          <button class="add-food-btn" (click)="openAddFoodModal(meal)">
            <lucide-icon [img]="Plus" size="16"></lucide-icon> Aggiungi Cibo
          </button>
        </div>
      </div>

      <!-- MODAL: ADD FOOD TO MEAL -->
      <div class="modal-backdrop" *ngIf="selectedMealForFood">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Aggiungi a: {{ selectedMealForFood.name }}</h3>
            <button class="modal-close" (click)="selectedMealForFood = null">
              <lucide-icon [img]="X" size="20"></lucide-icon>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label>Nome Cibo / Piatto *</label>
              <input type="text" [(ngModel)]="newFoodName" placeholder="Es. Riso Basmati e Pollo" class="form-input" autofocus />
            </div>

            <div class="form-group">
              <label>Calorie (kcal) *</label>
              <input type="number" [(ngModel)]="newFoodCalories" placeholder="Es. 450" class="form-input" min="0" />
            </div>

            <div class="form-group">
              <label>Quantità / Note (Opzionale)</label>
              <input type="text" [(ngModel)]="newFoodNote" placeholder="Es. 200g, 1 porzione" class="form-input" />
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-outline" (click)="selectedMealForFood = null">Annulla</button>
            <button class="btn btn-primary" (click)="confirmAddFood()" [disabled]="!newFoodName.trim() || !newFoodCalories">
              <lucide-icon [img]="Check" size="16"></lucide-icon> Salva Cibo
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL: ADD CUSTOM MEAL -->
      <div class="modal-backdrop" *ngIf="isAddingMeal">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Nuovo Pasto</h3>
            <button class="modal-close" (click)="isAddingMeal = false">
              <lucide-icon [img]="X" size="20"></lucide-icon>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label>Nome del Pasto *</label>
              <input type="text" [(ngModel)]="newMealName" placeholder="Es. Spuntino Serale, Post Workout..." class="form-input" autofocus />
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-outline" (click)="isAddingMeal = false">Annulla</button>
            <button class="btn btn-primary" (click)="confirmAddMeal()" [disabled]="!newMealName.trim()">
              Crea Pasto
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .diet-log-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-width: 650px;
      margin: 0 auto;
    }

    .date-nav-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-card, #18181b);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      border-radius: 14px;
      padding: 0.6rem 1rem;
    }

    .nav-arrow-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #ffffff;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(6, 182, 212, 0.15);
        color: var(--primary-cyan, #06b6d4);
      }
    }

    .date-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .calendar-icon {
      color: var(--primary-cyan, #06b6d4);
    }

    .date-text {
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
    }

    .today-badge {
      background: rgba(6, 182, 212, 0.15);
      color: var(--primary-cyan, #06b6d4);
      border: 1px solid rgba(6, 182, 212, 0.3);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
    }

    .calorie-summary-card {
      background: linear-gradient(145deg, #18181b 0%, #0f172a 100%);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .summary-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.1rem;
      font-weight: 700;
      color: #ffffff;
    }

    .flame-icon {
      color: #f97316;
      display: flex;
    }

    .target-edit-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #a1a1aa;
      font-size: 0.775rem;
      padding: 0.35rem 0.65rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;

      &:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }
    }

    .target-edit-form {
      background: rgba(0, 0, 0, 0.3);
      padding: 0.75rem;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      label {
        font-size: 0.8rem;
        color: #a1a1aa;
        margin-bottom: 0.4rem;
        display: block;
      }
    }

    .input-row {
      display: flex;
      gap: 0.5rem;

      input {
        flex: 1;
      }
    }

    .calorie-stats {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .main-stat {
      display: flex;
      align-items: baseline;
      gap: 0.3rem;
    }

    .consumed-value {
      font-size: 2.25rem;
      font-weight: 800;
      color: #ffffff;
    }

    .target-divider {
      font-size: 1.2rem;
      color: #71717a;
      font-weight: 600;
    }

    .unit {
      font-size: 0.9rem;
      color: #a1a1aa;
      margin-left: 0.2rem;
    }

    .remaining-badge {
      font-size: 0.85rem;
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 0.3rem 0.65rem;
      border-radius: 20px;

      &.over {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border-color: rgba(239, 68, 68, 0.3);
      }
    }

    .progress-container {
      height: 10px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 5px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #06b6d4, #10b981);
      border-radius: 5px;
      transition: width 0.3s ease;

      &.over-fill {
        background: linear-gradient(90deg, #f97316, #ef4444);
      }
    }

    .meals-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .empty-meals-card {
      background: var(--bg-card, #18181b);
      border: 1px dashed rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 2.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      text-align: center;
    }

    .empty-meals-icon {
      color: #71717a;
    }

    .empty-meals-text {
      font-size: 0.9rem;
      color: #a1a1aa;
      margin: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .section-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .meal-card {
      background: var(--bg-card, #18181b);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      border-radius: 14px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .meal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .meal-title-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .meal-icon {
      color: var(--primary-cyan, #06b6d4);
      display: flex;
    }

    .meal-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .meal-header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .meal-calories {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--primary-cyan, #06b6d4);
    }

    .delete-meal-btn {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      padding: 0.2rem;
      &:hover { color: #ef4444; }
    }

    .food-items-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .food-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .food-info {
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
    }

    .food-name {
      font-size: 0.9rem;
      font-weight: 600;
      color: #ffffff;
    }

    .food-note {
      font-size: 0.75rem;
      color: #a1a1aa;
    }

    .food-right {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .food-calories {
      font-size: 0.85rem;
      font-weight: 700;
      color: #a1a1aa;
    }

    .delete-item-btn {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      padding: 0.2rem;
      &:hover { color: #ef4444; }
    }

    .empty-meal-text {
      font-size: 0.8rem;
      color: #71717a;
      font-style: italic;
      padding: 0.25rem 0;
    }

    .add-food-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px dashed rgba(255, 255, 255, 0.15);
      color: #a1a1aa;
      border-radius: 8px;
      padding: 0.5rem;
      font-size: 0.825rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(6, 182, 212, 0.1);
        border-color: rgba(6, 182, 212, 0.4);
        color: var(--primary-cyan, #06b6d4);
      }
    }

    /* MODAL STYLING */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2500;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-card {
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      h3 {
        font-size: 1.1rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
    }

    .modal-close {
      background: transparent;
      border: none;
      color: #a1a1aa;
      cursor: pointer;
      &:hover { color: #ffffff; }
    }

    .modal-body {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      label {
        font-size: 0.8rem;
        font-weight: 600;
        color: #a1a1aa;
      }
    }

    .form-input {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      color: #ffffff;
      font-size: 0.9rem;
      &:focus {
        outline: none;
        border-color: var(--primary-cyan, #06b6d4);
      }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `]
})
export class DietLogComponent implements OnInit {
  readonly Flame = Flame;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Calendar = Calendar;
  readonly Edit3 = Edit3;
  readonly Utensils = Utensils;
  readonly Check = Check;
  readonly X = X;

  activeLog: DietLog | null = null;
  currentDateObj = new Date();

  // Target editing
  isEditingTarget = false;
  tempTargetCalories = 2000;

  // Add food modal
  selectedMealForFood: DietMealDetail | null = null;
  newFoodName = '';
  newFoodCalories: number | null = null;
  newFoodNote = '';

  // Add meal modal
  isAddingMeal = false;
  newMealName = '';

  constructor(private dietService: DietService) {}

  ngOnInit() {
    this.dietService.activeLog$.subscribe(log => {
      this.activeLog = log;
      if (log && log.target_calories) {
        this.tempTargetCalories = log.target_calories;
      }
    });
  }

  get formattedDisplayDate(): string {
    const d = this.currentDateObj;
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giug', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  }

  get isToday(): boolean {
    const todayStr = this.dietService.getTodayDateString();
    return this.dietService.formatDate(this.currentDateObj) === todayStr;
  }

  get totalConsumedCalories(): number {
    if (!this.activeLog || !this.activeLog.meals) return 0;
    return this.activeLog.meals.reduce((sum, meal) => sum + meal.total_calories, 0);
  }

  get remainingCalories(): number {
    const target = (this.activeLog && this.activeLog.target_calories) ? this.activeLog.target_calories : 2000;
    return target - this.totalConsumedCalories;
  }

  get caloriePercentage(): number {
    const target = (this.activeLog && this.activeLog.target_calories) ? this.activeLog.target_calories : 2000;
    if (target <= 0) return 0;
    return Math.min(100, Math.round((this.totalConsumedCalories / target) * 100));
  }

  mathAbs(num: number): number {
    return Math.abs(num);
  }

  changeDate(daysDelta: number) {
    this.currentDateObj.setDate(this.currentDateObj.getDate() + daysDelta);
    const dateStr = this.dietService.formatDate(this.currentDateObj);
    this.dietService.setDate(dateStr);
  }

  setToday() {
    this.currentDateObj = new Date();
    this.dietService.setDate(this.dietService.getTodayDateString());
  }

  toggleTargetEdit() {
    this.isEditingTarget = !this.isEditingTarget;
    if (this.activeLog && this.activeLog.target_calories) {
      this.tempTargetCalories = this.activeLog.target_calories;
    }
  }

  async saveTargetCalories() {
    await this.dietService.updateTargetCalories(this.tempTargetCalories);
    this.isEditingTarget = false;
  }

  openAddFoodModal(meal: DietMealDetail) {
    this.selectedMealForFood = meal;
    this.newFoodName = '';
    this.newFoodCalories = null;
    this.newFoodNote = '';
  }

  async confirmAddFood() {
    if (!this.selectedMealForFood || !this.newFoodName.trim() || !this.newFoodCalories) return;

    await this.dietService.addFoodItem(
      this.selectedMealForFood.id,
      this.newFoodName,
      this.newFoodCalories,
      this.newFoodNote
    );

    this.selectedMealForFood = null;
  }

  async deleteFoodItem(item: DietLogItem) {
    await this.dietService.deleteFoodItem(item.id);
  }

  openAddMealModal() {
    this.isAddingMeal = true;
    this.newMealName = '';
  }

  async confirmAddMeal() {
    if (!this.newMealName.trim()) return;
    await this.dietService.addMeal(this.newMealName);
    this.isAddingMeal = false;
  }

  async deleteMeal(meal: DietMealDetail) {
    if (confirm(`Sei sicuro di voler eliminare il pasto "${meal.name}"?`)) {
      await this.dietService.deleteMeal(meal.id);
    }
  }
}
