import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';

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
  X,
  Search,
  ArrowLeft,
  Clock,
  ScanBarcode,
  Camera
} from 'lucide-angular';
import { DietService } from '../../core/services/diet.service';
import { FoodService } from '../../core/services/food.service';
import { BarcodeLookupService } from '../../core/services/barcode-lookup.service';
import { MealPhotoAiService, MealPhotoAiError, RecognizedFoodItem } from '../../core/services/meal-photo-ai.service';
import { BarcodeScannerComponent } from './barcode-scanner.component';
import { MealPhotoCaptureComponent } from './meal-photo-capture.component';
import { DietLog, DietMealDetail, DietLogItem, Food } from '../../core/models/fitsync.models';

@Component({
  selector: 'app-diet-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterModule, LucideAngularModule, BarcodeScannerComponent, MealPhotoCaptureComponent],
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
          @if (isToday) {
            <span class="today-badge">Oggi</span>
          }
        </div>
    
        <button class="nav-arrow-btn" (click)="changeDate(1)" title="Giorno successivo">
          <lucide-icon [img]="ChevronRight" size="20"></lucide-icon>
        </button>
      </div>
    
      <!-- DAILY CALORIES SUMMARY CARD -->
      @if (activeLog) {
        <div class="calorie-summary-card">
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
          @if (isEditingTarget) {
            <div class="target-edit-form">
              <label>Obiettivo Calorie Giornaliere (kcal):</label>
              <div class="input-row">
                <input type="number" [(ngModel)]="tempTargetCalories" min="500" max="10000" class="form-input" />
                <button class="btn btn-sm btn-primary" (click)="saveTargetCalories()">Salva</button>
                <button class="btn btn-sm btn-outline" (click)="isEditingTarget = false">Annulla</button>
              </div>
            </div>
          }
          <div class="calorie-stats">
            <div class="main-stat">
              <span class="consumed-value">{{ totalConsumedCalories }}</span>
              <span class="target-divider">/ {{ activeLog.target_calories || 2000 }}</span>
              <span class="unit">kcal</span>
            </div>
            <div class="remaining-badge" [class.over]="remainingCalories < 0">
              @if (remainingCalories >= 0) {
                <span>Rimanenti: <strong>{{ remainingCalories }} kcal</strong></span>
              }
              @if (remainingCalories < 0) {
                <span>Superato di: <strong>{{ mathAbs(remainingCalories) }} kcal</strong></span>
              }
            </div>
          </div>
          <!-- PROGRESS BAR -->
          <div class="progress-container">
            <div class="progress-fill" [style.width.%]="caloriePercentage" [class.over-fill]="remainingCalories < 0"></div>
          </div>
          <!-- MACRO TOTALS -->
          <div class="macro-totals-row">
            <div class="macro-pill protein">
              <span class="macro-label">Proteine</span>
              <span class="macro-value">{{ totalConsumedProtein }}g</span>
            </div>
            <div class="macro-pill carbs">
              <span class="macro-label">Carboidrati</span>
              <span class="macro-value">{{ totalConsumedCarbs }}g</span>
            </div>
            <div class="macro-pill fat">
              <span class="macro-label">Grassi</span>
              <span class="macro-value">{{ totalConsumedFat }}g</span>
            </div>
          </div>
        </div>
      }
    
      <!-- FLEXIBLE MEALS LIST -->
      @if (activeLog) {
        <div class="meals-section">
          <div class="section-header">
            <h2 class="section-title">I Tuoi Pasti</h2>
            <button class="btn btn-sm btn-outline btn-add-meal" (click)="openAddMealModal()">
              <lucide-icon [img]="Plus" size="16"></lucide-icon> Nuovo Pasto
            </button>
          </div>
          <!-- EMPTY MEALS STATE -->
          @if (!activeLog.meals || activeLog.meals.length === 0) {
            <div class="empty-meals-card">
              <lucide-icon [img]="Utensils" size="36" class="empty-meals-icon"></lucide-icon>
              <p class="empty-meals-text">Nessun pasto creato per questo giorno.</p>
              <button class="btn btn-sm btn-primary" (click)="openAddMealModal()">
                <lucide-icon [img]="Plus" size="16"></lucide-icon> Crea il Tuo Primo Pasto
              </button>
            </div>
          }
          <!-- MEAL CARDS -->
          @for (meal of activeLog.meals; track meal) {
            <div class="meal-card">
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
              @if (meal.items && meal.items.length > 0) {
                <div class="food-items-list">
                  @for (item of meal.items; track item) {
                    <div class="food-item-row">
                      <div class="food-info">
                        <span class="food-name">{{ item.name }}</span>
                        @if (item.amount_note) {
                          <span class="food-note">({{ item.amount_note }})</span>
                        }
                      </div>
                      <div class="food-right">
                        <span class="food-calories">{{ item.calories }} kcal</span>
                        <button class="edit-item-btn" (click)="openEditFoodItem(item)" title="Modifica">
                          <lucide-icon [img]="Edit3" size="14"></lucide-icon>
                        </button>
                        <button class="delete-item-btn" (click)="deleteFoodItem(item)" title="Rimuovi cibo">
                          <lucide-icon [img]="Trash2" size="14"></lucide-icon>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
              @if (!meal.items || meal.items.length === 0) {
                <div class="empty-meal-text">
                  Nessun cibo aggiunto a questo pasto.
                </div>
              }
              <!-- ADD FOOD BUTTON -->
              <button class="add-food-btn" (click)="openAddFoodModal(meal)">
                <lucide-icon [img]="Plus" size="16"></lucide-icon> Aggiungi Cibo
              </button>
            </div>
          }
        </div>
      }
    
      <!-- MODAL: ADD FOOD TO MEAL -->
      @if (selectedMealForFood) {
        <div class="modal-backdrop">
          <div class="modal-card food-picker-modal">
            <div class="modal-header">
              <h3>Aggiungi a: {{ selectedMealForFood.name }}</h3>
              <button class="modal-close" (click)="selectedMealForFood = null">
                <lucide-icon [img]="X" size="20"></lucide-icon>
              </button>
            </div>

            <!-- STATO 1: RICERCA NEL CATALOGO -->
            @if (!selectedCatalogFood && !showManualEntry && !showBarcodeScanner && !isLookingUpBarcode && !barcodeManualEntry && !scanErrorMessage && !showPhotoCapture && !isAnalyzingPhoto && !photoAnalysisError && recognizedFoodItems.length === 0) {
              <div class="modal-body">
                <div class="search-input-wrap">
                  <lucide-icon [img]="Search" size="16" class="search-icon"></lucide-icon>
                  <input type="text" [(ngModel)]="foodSearchQuery" placeholder="Cerca un alimento..." class="form-input search-input" autofocus />
                </div>

                @if (!foodSearchQuery.trim()) {
                  @if (frequentFoods.length > 0) {
                    <div class="results-section-label">
                      <lucide-icon [img]="Clock" size="13"></lucide-icon>
                      <span>Usati di frequente in questo pasto</span>
                    </div>
                    <div class="food-results-list">
                      @for (food of frequentFoods; track food.id) {
                        <div class="food-result-row" (click)="selectCatalogFood(food)">
                          <span class="food-result-name">{{ food.name }}</span>
                          <div class="food-right">
                            <span class="food-result-kcal">{{ food.kcal_100g }} kcal/100g</span>
                            @if (canDeleteFood(food)) {
                              <button class="delete-item-btn" (click)="$event.stopPropagation(); deleteCustomFood(food)" title="Elimina alimento custom">
                                <lucide-icon [img]="Trash2" size="14"></lucide-icon>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="picker-hint">Digita per cercare un alimento nel catalogo.</p>
                  }
                } @else {
                  <div class="food-results-list">
                    @for (food of filteredFoods; track food.id) {
                      <div class="food-result-row" (click)="selectCatalogFood(food)">
                        <span class="food-result-name">{{ food.name }}</span>
                        <div class="food-right">
                          <span class="food-result-kcal">{{ food.kcal_100g }} kcal/100g</span>
                          @if (canDeleteFood(food)) {
                            <button class="delete-item-btn" (click)="$event.stopPropagation(); deleteCustomFood(food)" title="Elimina alimento custom">
                              <lucide-icon [img]="Trash2" size="14"></lucide-icon>
                            </button>
                          }
                        </div>
                      </div>
                    }
                    @if (filteredFoods.length === 0) {
                      <p class="picker-hint">Nessun alimento trovato.</p>
                    }
                  </div>
                }

                <button class="manual-fallback-link" (click)="showManualEntry = true">
                  Alimento non trovato? Inserisci manualmente
                </button>
                <button class="manual-fallback-link" (click)="startBarcodeScan()">
                  <lucide-icon [img]="ScanBarcode" size="14"></lucide-icon> Scansiona codice a barre
                </button>
                <button class="manual-fallback-link" [disabled]="!isOnline" [title]="!isOnline ? 'Richiede connessione a internet' : ''" (click)="startPhotoCapture()">
                  <lucide-icon [img]="Camera" size="14"></lucide-icon> Fotografa il piatto
                </button>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="selectedMealForFood = null">Annulla</button>
              </div>
            }

            <!-- STATO: CATTURA FOTO PIATTO -->
            @if (showPhotoCapture) {
              <div class="modal-body">
                <button class="back-link" (click)="showPhotoCapture = false">
                  <lucide-icon [img]="ArrowLeft" size="14"></lucide-icon> Torna alla ricerca
                </button>
                <app-meal-photo-capture
                  (photoReady)="onPhotoReady($event)"
                  (cancelled)="showPhotoCapture = false">
                </app-meal-photo-capture>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="selectedMealForFood = null">Annulla</button>
              </div>
            }

            <!-- STATO: ANALISI FOTO IN CORSO -->
            @if (isAnalyzingPhoto) {
              <div class="modal-body">
                <p class="picker-hint">Analisi del piatto in corso...</p>
              </div>
            }

            <!-- STATO: ERRORE ANALISI FOTO -->
            @if (photoAnalysisError) {
              <div class="modal-body">
                <p class="picker-hint">{{ photoAnalysisError }}</p>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="photoAnalysisError = null">Torna alla ricerca</button>
                <button class="btn btn-primary" (click)="photoAnalysisError = null; showPhotoCapture = true">Riprova</button>
              </div>
            }

            <!-- STATO: ALIMENTI RICONOSCIUTI DALLA FOTO (lista editabile) -->
            @if (recognizedFoodItems.length > 0) {
              <div class="modal-body">
                <button class="back-link" (click)="recognizedFoodItems = []">
                  <lucide-icon [img]="ArrowLeft" size="14"></lucide-icon> Torna alla ricerca
                </button>
                @for (item of recognizedFoodItems; track $index) {
                  <div class="recognized-item-card">
                    <div class="recognized-item-header">
                      <input type="text" [(ngModel)]="item.name" class="form-input" />
                      <button class="delete-item-btn" (click)="removeRecognizedItem($index)" title="Rimuovi">
                        <lucide-icon [img]="Trash2" size="14"></lucide-icon>
                      </button>
                    </div>
                    <div class="macro-input-row">
                      <div class="form-group">
                        <label>Grammi</label>
                        <input type="number" [(ngModel)]="item.estimated_grams" class="form-input" min="0" />
                      </div>
                      <div class="form-group">
                        <label>Kcal/100g</label>
                        <input type="number" [(ngModel)]="item.kcal_100g" class="form-input" min="0" />
                      </div>
                    </div>
                    <div class="macro-input-row">
                      <div class="form-group">
                        <label>Prot./100g</label>
                        <input type="number" [(ngModel)]="item.protein_100g" class="form-input" min="0" />
                      </div>
                      <div class="form-group">
                        <label>Carb./100g</label>
                        <input type="number" [(ngModel)]="item.carbs_100g" class="form-input" min="0" />
                      </div>
                      <div class="form-group">
                        <label>Grassi/100g</label>
                        <input type="number" [(ngModel)]="item.fat_100g" class="form-input" min="0" />
                      </div>
                    </div>
                    <div class="macro-preview-grid">
                      <div class="macro-preview-item"><span class="mp-label">Kcal</span><span class="mp-value">{{ photoItemPreview(item).calories }}</span></div>
                      <div class="macro-preview-item"><span class="mp-label">Prot.</span><span class="mp-value">{{ photoItemPreview(item).protein }}g</span></div>
                      <div class="macro-preview-item"><span class="mp-label">Carb.</span><span class="mp-value">{{ photoItemPreview(item).carbs }}g</span></div>
                      <div class="macro-preview-item"><span class="mp-label">Grassi</span><span class="mp-value">{{ photoItemPreview(item).fat }}g</span></div>
                    </div>
                  </div>
                }
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="selectedMealForFood = null">Annulla</button>
                <button class="btn btn-primary" [disabled]="isSavingPhotoItems" (click)="confirmSavePhotoItems()">
                  <lucide-icon [img]="Check" size="16"></lucide-icon> Salva {{ recognizedFoodItems.length }} aliment{{ recognizedFoodItems.length === 1 ? 'o' : 'i' }}
                </button>
              </div>
            }

            <!-- STATO SCANNER: FOTOCAMERA CODICE A BARRE -->
            @if (showBarcodeScanner) {
              <div class="modal-body">
                <app-barcode-scanner
                  (detected)="onBarcodeDetected($event)"
                  (cancelled)="closeBarcodeScan()"
                  (cameraError)="onCameraError($event)">
                </app-barcode-scanner>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="selectedMealForFood = null">Annulla</button>
              </div>
            }

            <!-- STATO RICERCA PRODOTTO IN CORSO -->
            @if (isLookingUpBarcode) {
              <div class="modal-body">
                <p class="picker-hint">Ricerca prodotto in corso...</p>
              </div>
            }

            <!-- STATO ERRORE FOTOCAMERA (senza fallback a creazione custom) -->
            @if (scanErrorMessage && !barcodeManualEntry) {
              <div class="modal-body">
                <p class="picker-hint">{{ scanErrorMessage }}</p>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="scanErrorMessage = null">Torna alla ricerca</button>
              </div>
            }

            <!-- STATO: ALIMENTO CUSTOM DA BARCODE (prodotto non trovato / rete assente) -->
            @if (barcodeManualEntry) {
              <div class="modal-body">
                <button class="back-link" (click)="cancelBarcodeManualEntry()">
                  <lucide-icon [img]="ArrowLeft" size="14"></lucide-icon> Torna alla ricerca
                </button>
                @if (scanErrorMessage) {
                  <p class="picker-hint">{{ scanErrorMessage }}</p>
                }
                <div class="form-group">
                  <label>Codice a barre</label>
                  <input type="text" [value]="barcodeManualEntry" class="form-input" disabled />
                </div>
                <div class="form-group">
                  <label>Nome Alimento *</label>
                  <input type="text" [(ngModel)]="newFoodName" placeholder="Es. Biscotti al cioccolato" class="form-input" autofocus />
                </div>
                <div class="form-group">
                  <label>Calorie per 100g (kcal) *</label>
                  <input type="number" [(ngModel)]="newFoodCalories" placeholder="Es. 450" class="form-input" min="0" />
                </div>
                <div class="macro-input-row">
                  <div class="form-group">
                    <label>Proteine per 100g (g)</label>
                    <input type="number" [(ngModel)]="newFoodProtein" placeholder="0" class="form-input" min="0" />
                  </div>
                  <div class="form-group">
                    <label>Carboidrati per 100g (g)</label>
                    <input type="number" [(ngModel)]="newFoodCarbs" placeholder="0" class="form-input" min="0" />
                  </div>
                  <div class="form-group">
                    <label>Grassi per 100g (g)</label>
                    <input type="number" [(ngModel)]="newFoodFat" placeholder="0" class="form-input" min="0" />
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="selectedMealForFood = null">Annulla</button>
                <button class="btn btn-primary" (click)="confirmCustomFoodFromBarcode()" [disabled]="!newFoodName.trim() || !newFoodCalories || isSavingFood">
                  <lucide-icon [img]="Check" size="16"></lucide-icon> Salva Alimento
                </button>
              </div>
            }

            <!-- STATO 2: QUANTITÀ ALIMENTO DA CATALOGO -->
            @if (selectedCatalogFood) {
              <div class="modal-body">
                <button class="back-link" (click)="backToSearch()">
                  <lucide-icon [img]="ArrowLeft" size="14"></lucide-icon> Cambia alimento
                </button>
                @if (canDeleteFood(selectedCatalogFood)) {
                  <div class="form-group">
                    <label>Nome Alimento *</label>
                    <input type="text" [(ngModel)]="newFoodName" class="form-input" />
                  </div>
                  <div class="macro-input-row">
                    <div class="form-group">
                      <label>Kcal per 100g *</label>
                      <input type="number" [(ngModel)]="newFoodCalories" class="form-input" min="0" />
                    </div>
                    <div class="form-group">
                      <label>Proteine per 100g (g)</label>
                      <input type="number" [(ngModel)]="newFoodProtein" class="form-input" min="0" />
                    </div>
                    <div class="form-group">
                      <label>Carboidrati per 100g (g)</label>
                      <input type="number" [(ngModel)]="newFoodCarbs" class="form-input" min="0" />
                    </div>
                    <div class="form-group">
                      <label>Grassi per 100g (g)</label>
                      <input type="number" [(ngModel)]="newFoodFat" class="form-input" min="0" />
                    </div>
                  </div>
                } @else {
                  <div class="selected-food-name">{{ selectedCatalogFood.name }}</div>
                }
                <div class="form-group">
                  <label>Quantità (grammi) *</label>
                  <input type="number" [(ngModel)]="catalogQuantityGrams" placeholder="Es. 150" class="form-input" min="0" autofocus />
                </div>
                @if (catalogPreview) {
                  <div class="macro-preview-grid">
                    <div class="macro-preview-item"><span class="mp-label">Kcal</span><span class="mp-value">{{ catalogPreview.calories }}</span></div>
                    <div class="macro-preview-item"><span class="mp-label">Prot.</span><span class="mp-value">{{ catalogPreview.protein }}g</span></div>
                    <div class="macro-preview-item"><span class="mp-label">Carb.</span><span class="mp-value">{{ catalogPreview.carbs }}g</span></div>
                    <div class="macro-preview-item"><span class="mp-label">Grassi</span><span class="mp-value">{{ catalogPreview.fat }}g</span></div>
                  </div>
                }
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="selectedMealForFood = null">Annulla</button>
                <button class="btn btn-primary" (click)="confirmAddCatalogFood()" [disabled]="!catalogQuantityGrams || !newFoodName.trim() || !newFoodCalories || isSavingFood">
                  <lucide-icon [img]="Check" size="16"></lucide-icon> Salva Cibo
                </button>
              </div>
            }

            <!-- STATO 3: INSERIMENTO MANUALE -->
            @if (showManualEntry) {
              <div class="modal-body">
                <button class="back-link" (click)="showManualEntry = false">
                  <lucide-icon [img]="ArrowLeft" size="14"></lucide-icon> Torna alla ricerca
                </button>
                <div class="form-group">
                  <label>Nome Cibo / Piatto *</label>
                  <input type="text" [(ngModel)]="newFoodName" placeholder="Es. Riso Basmati e Pollo" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Calorie (kcal) *</label>
                  <input type="number" [(ngModel)]="newFoodCalories" placeholder="Es. 450" class="form-input" min="0" />
                </div>
                <div class="form-group">
                  <label>Quantità / Note (Opzionale)</label>
                  <input type="text" [(ngModel)]="newFoodNote" placeholder="Es. 200g, 1 porzione" class="form-input" />
                </div>
                <div class="macro-input-row">
                  <div class="form-group">
                    <label>Proteine (g)</label>
                    <input type="number" [(ngModel)]="newFoodProtein" placeholder="0" class="form-input" min="0" />
                  </div>
                  <div class="form-group">
                    <label>Carboidrati (g)</label>
                    <input type="number" [(ngModel)]="newFoodCarbs" placeholder="0" class="form-input" min="0" />
                  </div>
                  <div class="form-group">
                    <label>Grassi (g)</label>
                    <input type="number" [(ngModel)]="newFoodFat" placeholder="0" class="form-input" min="0" />
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-outline" (click)="selectedMealForFood = null">Annulla</button>
                <button class="btn btn-primary" (click)="confirmAddManualFood()" [disabled]="!newFoodName.trim() || !newFoodCalories || isSavingFood">
                  <lucide-icon [img]="Check" size="16"></lucide-icon> Salva Cibo
                </button>
              </div>
            }
          </div>
        </div>
      }
    
      <!-- MODAL: ADD CUSTOM MEAL -->
      @if (isAddingMeal) {
        <div class="modal-backdrop">
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
              <button class="btn btn-primary" (click)="confirmAddMeal()" [disabled]="!newMealName.trim() || isSavingMeal">
                Crea Pasto
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: MODIFICA ALIMENTO GIÀ NEL PASTO -->
      @if (editingFoodItem) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Modifica: {{ editingFoodItem.name }}</h3>
              <button class="modal-close" (click)="closeEditFoodItem()">
                <lucide-icon [img]="X" size="20"></lucide-icon>
              </button>
            </div>
            <div class="modal-body">
              @if (editingFoodItem.food_id) {
                <div class="form-group">
                  <label>Quantità (grammi) *</label>
                  <input type="number" [(ngModel)]="editItemQuantityGrams" placeholder="Es. 150" class="form-input" min="0" autofocus />
                </div>
                @if (editItemPreview) {
                  <div class="macro-preview-grid">
                    <div class="macro-preview-item"><span class="mp-label">Kcal</span><span class="mp-value">{{ editItemPreview.calories }}</span></div>
                    <div class="macro-preview-item"><span class="mp-label">Prot.</span><span class="mp-value">{{ editItemPreview.protein }}g</span></div>
                    <div class="macro-preview-item"><span class="mp-label">Carb.</span><span class="mp-value">{{ editItemPreview.carbs }}g</span></div>
                    <div class="macro-preview-item"><span class="mp-label">Grassi</span><span class="mp-value">{{ editItemPreview.fat }}g</span></div>
                  </div>
                }
              } @else {
                <div class="form-group">
                  <label>Nome Cibo / Piatto *</label>
                  <input type="text" [(ngModel)]="editItemName" class="form-input" autofocus />
                </div>
                <div class="form-group">
                  <label>Calorie (kcal) *</label>
                  <input type="number" [(ngModel)]="editItemCalories" class="form-input" min="0" />
                </div>
                <div class="form-group">
                  <label>Quantità / Note (Opzionale)</label>
                  <input type="text" [(ngModel)]="editItemNote" class="form-input" />
                </div>
                <div class="macro-input-row">
                  <div class="form-group">
                    <label>Proteine (g)</label>
                    <input type="number" [(ngModel)]="editItemProtein" class="form-input" min="0" />
                  </div>
                  <div class="form-group">
                    <label>Carboidrati (g)</label>
                    <input type="number" [(ngModel)]="editItemCarbs" class="form-input" min="0" />
                  </div>
                  <div class="form-group">
                    <label>Grassi (g)</label>
                    <input type="number" [(ngModel)]="editItemFat" class="form-input" min="0" />
                  </div>
                </div>
              }
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" (click)="closeEditFoodItem()">Annulla</button>
              <button
                class="btn btn-primary"
                (click)="confirmEditFoodItem()"
                [disabled]="isSavingItemEdit || (editingFoodItem.food_id ? !editItemQuantityGrams : (!editItemName.trim() || !editItemCalories))"
              >
                <lucide-icon [img]="Check" size="16"></lucide-icon> Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      }

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

    .macro-totals-row {
      display: flex;
      gap: 0.5rem;
    }

    .macro-pill {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 0.5rem 0.4rem;

      &.protein { border-color: rgba(168, 85, 247, 0.3); }
      &.carbs { border-color: rgba(249, 115, 22, 0.3); }
      &.fat { border-color: rgba(234, 179, 8, 0.3); }
    }

    .macro-label {
      font-size: 0.7rem;
      color: #a1a1aa;
    }

    .macro-value {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
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

    .edit-item-btn {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      padding: 0.2rem;
      &:hover { color: var(--primary-cyan, #06b6d4); }
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
      align-items: flex-start;
      justify-content: center;
      padding: 8vh 1rem 1rem;
    }

    .modal-card {
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      max-height: 90vh;
      overflow-y: auto;
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

    .food-picker-modal {
      max-height: 85vh;
    }

    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 0.7rem;
      color: #71717a;
      pointer-events: none;
    }

    .search-input {
      padding-left: 2.1rem;
    }

    .results-section-label {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      color: #71717a;
      font-weight: 600;
    }

    .food-results-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      max-height: 40vh;
      overflow-y: auto;
    }

    .food-result-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 0.55rem 0.75rem;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(6, 182, 212, 0.1);
        border-color: rgba(6, 182, 212, 0.4);
      }
    }

    .food-result-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #ffffff;
    }

    .food-result-kcal {
      font-size: 0.75rem;
      color: #a1a1aa;
    }

    .picker-hint {
      font-size: 0.825rem;
      color: #71717a;
      font-style: italic;
      margin: 0.25rem 0;
    }

    .manual-fallback-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      background: transparent;
      border: none;
      color: var(--primary-cyan, #06b6d4);
      font-size: 0.8rem;
      cursor: pointer;
      text-align: center;
      padding: 0.4rem;

      &:hover { text-decoration: underline; }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        &:hover { text-decoration: none; }
      }
    }

    .recognized-item-card {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 0.75rem;
    }

    .recognized-item-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .form-input { flex: 1; }
    }

    .back-link {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      background: transparent;
      border: none;
      color: #a1a1aa;
      font-size: 0.8rem;
      cursor: pointer;
      align-self: flex-start;
      padding: 0;

      &:hover { color: #ffffff; }
    }

    .selected-food-name {
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
    }

    .macro-preview-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
    }

    .macro-preview-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      padding: 0.5rem 0.25rem;
    }

    .mp-label {
      font-size: 0.65rem;
      color: #a1a1aa;
    }

    .mp-value {
      font-size: 0.85rem;
      font-weight: 700;
      color: #ffffff;
    }

    .macro-input-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;

      .form-group {
        flex: 1 1 120px;
        min-width: 0;
      }
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
  readonly Search = Search;
  readonly ArrowLeft = ArrowLeft;
  readonly Clock = Clock;
  readonly ScanBarcode = ScanBarcode;
  readonly Camera = Camera;

  activeLog: DietLog | null = null;
  currentDateObj = new Date();

  // Target editing
  isEditingTarget = false;
  tempTargetCalories = 2000;

  // Add food modal — ricerca nel catalogo
  selectedMealForFood: DietMealDetail | null = null;
  allFoods: Food[] = [];
  frequentFoods: Food[] = [];
  foodSearchQuery = '';
  selectedCatalogFood: Food | null = null;
  catalogQuantityGrams: number | null = 100;
  isSavingFood = false;

  // Add food modal — inserimento manuale (fallback)
  showManualEntry = false;
  newFoodName = '';
  newFoodCalories: number | null = null;
  newFoodNote = '';
  newFoodProtein: number | null = null;
  newFoodCarbs: number | null = null;
  newFoodFat: number | null = null;

  // Add food modal — scansione barcode
  showBarcodeScanner = false;
  isLookingUpBarcode = false;
  scanErrorMessage: string | null = null;
  barcodeManualEntry: string | null = null; // valorizzato = stato "crea alimento custom da barcode"

  // Add food modal — foto del piatto (riconoscimento AI)
  showPhotoCapture = false;
  isAnalyzingPhoto = false;
  photoAnalysisError: string | null = null;
  recognizedFoodItems: RecognizedFoodItem[] = [];
  isSavingPhotoItems = false;

  // Add meal modal
  isAddingMeal = false;
  newMealName = '';
  isSavingMeal = false;

  // Edit food item modal (alimento già aggiunto a un pasto)
  editingFoodItem: DietLogItem | null = null;
  editItemFood: Food | null = null;
  editItemQuantityGrams: number | null = null;
  editItemName = '';
  editItemCalories: number | null = null;
  editItemNote = '';
  editItemProtein: number | null = null;
  editItemCarbs: number | null = null;
  editItemFat: number | null = null;
  isSavingItemEdit = false;

  constructor(
    private dietService: DietService,
    private foodService: FoodService,
    private barcodeLookupService: BarcodeLookupService,
    private mealPhotoAiService: MealPhotoAiService,
    private cdr: ChangeDetectorRef
  ) {}

  get isOnline(): boolean {
    return navigator.onLine;
  }

  ngOnInit() {
    this.dietService.activeLog$.subscribe(log => {
      this.activeLog = log;
      if (log && log.target_calories) {
        this.tempTargetCalories = log.target_calories;
      }
      this.cdr.markForCheck();
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

  get totalConsumedProtein(): number {
    if (!this.activeLog || !this.activeLog.meals) return 0;
    return Math.round(this.activeLog.meals.reduce((sum, meal) => sum + meal.total_protein, 0) * 10) / 10;
  }

  get totalConsumedCarbs(): number {
    if (!this.activeLog || !this.activeLog.meals) return 0;
    return Math.round(this.activeLog.meals.reduce((sum, meal) => sum + meal.total_carbs, 0) * 10) / 10;
  }

  get totalConsumedFat(): number {
    if (!this.activeLog || !this.activeLog.meals) return 0;
    return Math.round(this.activeLog.meals.reduce((sum, meal) => sum + meal.total_fat, 0) * 10) / 10;
  }

  get filteredFoods(): Food[] {
    const q = this.foodSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return this.allFoods.filter(f =>
      f.name.toLowerCase().includes(q) || (f.original_name?.toLowerCase().includes(q) ?? false)
    );
  }

  get catalogPreview(): { calories: number; protein: number; carbs: number; fat: number } | null {
    if (!this.selectedCatalogFood || !this.catalogQuantityGrams) return null;
    const factor = this.catalogQuantityGrams / 100;
    return {
      calories: Math.round((this.newFoodCalories ?? 0) * factor),
      protein: Math.round((this.newFoodProtein ?? 0) * factor * 10) / 10,
      carbs: Math.round((this.newFoodCarbs ?? 0) * factor * 10) / 10,
      fat: Math.round((this.newFoodFat ?? 0) * factor * 10) / 10
    };
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
    this.cdr.markForCheck();
  }

  async openAddFoodModal(meal: DietMealDetail) {
    this.selectedMealForFood = meal;
    this.foodSearchQuery = '';
    this.selectedCatalogFood = null;
    this.catalogQuantityGrams = 100;
    this.showManualEntry = false;
    this.newFoodName = '';
    this.newFoodCalories = null;
    this.newFoodNote = '';
    this.newFoodProtein = null;
    this.newFoodCarbs = null;
    this.newFoodFat = null;
    this.showBarcodeScanner = false;
    this.isLookingUpBarcode = false;
    this.scanErrorMessage = null;
    this.barcodeManualEntry = null;
    this.showPhotoCapture = false;
    this.isAnalyzingPhoto = false;
    this.photoAnalysisError = null;
    this.recognizedFoodItems = [];
    this.isSavingPhotoItems = false;

    this.allFoods = await this.foodService.getAllFoods();
    this.frequentFoods = await this.foodService.getFrequentFoodsForMeal(meal.name, 5);
    this.cdr.markForCheck();
  }

  selectCatalogFood(food: Food) {
    this.selectedCatalogFood = food;
    this.catalogQuantityGrams = 100;
    this.newFoodName = food.name;
    this.newFoodCalories = food.kcal_100g;
    this.newFoodProtein = food.protein_100g;
    this.newFoodCarbs = food.carbs_100g;
    this.newFoodFat = food.fat_100g;
  }

  backToSearch() {
    this.selectedCatalogFood = null;
  }

  canDeleteFood(food: Food): boolean {
    return this.foodService.canDeleteCustomFood(food);
  }

  async deleteCustomFood(food: Food) {
    if (!confirm(`Eliminare "${food.name}" dal catalogo? Le voci già registrate nel diario non saranno modificate.`)) return;

    await this.foodService.deleteCustomFood(food.id);
    this.allFoods = this.allFoods.filter(f => f.id !== food.id);
    this.frequentFoods = this.frequentFoods.filter(f => f.id !== food.id);
    this.cdr.markForCheck();
  }

  startBarcodeScan() {
    if (this.showBarcodeScanner) return;
    this.scanErrorMessage = null;
    this.showBarcodeScanner = true;
  }

  closeBarcodeScan() {
    this.showBarcodeScanner = false;
  }

  onCameraError(kind: 'denied' | 'unavailable') {
    this.showBarcodeScanner = false;
    this.scanErrorMessage = kind === 'denied'
      ? 'Permesso fotocamera negato. Puoi comunque cercare o inserire manualmente.'
      : 'Fotocamera non disponibile su questo dispositivo.';
    this.cdr.markForCheck();
  }

  startPhotoCapture() {
    if (!this.isOnline) return;
    this.photoAnalysisError = null;
    this.showPhotoCapture = true;
  }

  async onPhotoReady(photo: { base64: string; mimeType: string }) {
    this.showPhotoCapture = false;
    this.isAnalyzingPhoto = true;
    this.cdr.markForCheck();

    try {
      const items = await this.mealPhotoAiService.analyzeMealPhoto(photo.base64, photo.mimeType);
      if (items.length === 0) {
        this.photoAnalysisError = 'Nessun alimento riconosciuto nella foto. Riprova con un\'inquadratura più chiara o inserisci manualmente.';
      } else {
        this.recognizedFoodItems = items;
      }
    } catch (err) {
      this.photoAnalysisError = err instanceof MealPhotoAiError
        ? err.message
        : 'Si è verificato un errore durante l\'analisi della foto.';
    } finally {
      this.isAnalyzingPhoto = false;
      this.cdr.markForCheck();
    }
  }

  removeRecognizedItem(index: number) {
    this.recognizedFoodItems = this.recognizedFoodItems.filter((_, i) => i !== index);
  }

  photoItemPreview(item: RecognizedFoodItem): { calories: number; protein: number; carbs: number; fat: number } {
    const factor = (item.estimated_grams || 0) / 100;
    return {
      calories: Math.round((item.kcal_100g || 0) * factor),
      protein: Math.round((item.protein_100g || 0) * factor * 10) / 10,
      carbs: Math.round((item.carbs_100g || 0) * factor * 10) / 10,
      fat: Math.round((item.fat_100g || 0) * factor * 10) / 10
    };
  }

  async confirmSavePhotoItems() {
    if (this.isSavingPhotoItems || !this.selectedMealForFood || this.recognizedFoodItems.length === 0) return;

    this.isSavingPhotoItems = true;
    try {
      const items = this.recognizedFoodItems.map(item => {
        const preview = this.photoItemPreview(item);
        return {
          name: item.name,
          calories: preview.calories,
          amountNote: `${Math.round(item.estimated_grams)}g`,
          protein: preview.protein,
          carbs: preview.carbs,
          fat: preview.fat
        };
      });
      await this.dietService.addFoodItemsBatch(this.selectedMealForFood.id, items);
      this.selectedMealForFood = null;
    } finally {
      this.isSavingPhotoItems = false;
      this.cdr.markForCheck();
    }
  }

  cancelBarcodeManualEntry() {
    this.barcodeManualEntry = null;
    this.scanErrorMessage = null;
    this.newFoodName = '';
    this.newFoodCalories = null;
    this.newFoodProtein = null;
    this.newFoodCarbs = null;
    this.newFoodFat = null;
  }

  async onBarcodeDetected(barcode: string) {
    this.showBarcodeScanner = false;

    const existing = await this.foodService.findByBarcode(barcode);
    if (existing) {
      this.selectCatalogFood(existing);
      this.cdr.markForCheck();
      return;
    }

    this.isLookingUpBarcode = true;
    this.cdr.markForCheck();
    try {
      const result = await this.barcodeLookupService.lookupProduct(barcode);
      if (!result) {
        this.scanErrorMessage = 'Prodotto non trovato, inserisci i valori manualmente.';
        this.openBarcodeManualEntry(barcode);
        return;
      }
      const newFood = await this.foodService.createCustomFood(
        result.name, result.kcal_100g, result.protein_100g, result.carbs_100g, result.fat_100g, false, barcode
      );
      this.allFoods = [...this.allFoods, newFood];
      this.selectCatalogFood(newFood);
    } catch {
      this.scanErrorMessage = 'Connessione non disponibile, inserisci i valori manualmente.';
      this.openBarcodeManualEntry(barcode);
    } finally {
      this.isLookingUpBarcode = false;
      this.cdr.markForCheck();
    }
  }

  private openBarcodeManualEntry(barcode: string) {
    this.barcodeManualEntry = barcode;
    this.newFoodName = '';
    this.newFoodCalories = null;
    this.newFoodProtein = null;
    this.newFoodCarbs = null;
    this.newFoodFat = null;
  }

  async confirmCustomFoodFromBarcode() {
    if (this.isSavingFood || !this.barcodeManualEntry || !this.newFoodName.trim() || !this.newFoodCalories) return;

    this.isSavingFood = true;
    try {
      const newFood = await this.foodService.createCustomFood(
        this.newFoodName,
        this.newFoodCalories,
        this.newFoodProtein ?? 0,
        this.newFoodCarbs ?? 0,
        this.newFoodFat ?? 0,
        false,
        this.barcodeManualEntry
      );
      this.allFoods = [...this.allFoods, newFood];
      this.barcodeManualEntry = null;
      this.scanErrorMessage = null;
      this.selectCatalogFood(newFood);
    } finally {
      this.isSavingFood = false;
      this.cdr.markForCheck();
    }
  }

  async confirmAddCatalogFood() {
    if (this.isSavingFood || !this.selectedMealForFood || !this.selectedCatalogFood || !this.catalogQuantityGrams) return;

    this.isSavingFood = true;
    try {
      if (this.canDeleteFood(this.selectedCatalogFood)) {
        const updated = await this.foodService.updateCustomFood(this.selectedCatalogFood, {
          name: this.newFoodName,
          kcal_100g: this.newFoodCalories ?? 0,
          protein_100g: this.newFoodProtein ?? 0,
          carbs_100g: this.newFoodCarbs ?? 0,
          fat_100g: this.newFoodFat ?? 0
        });
        const idx = this.allFoods.findIndex(f => f.id === updated.id);
        if (idx !== -1) this.allFoods[idx] = updated;
      }
      await this.dietService.addFoodItemFromCatalog(
        this.selectedMealForFood.id,
        this.selectedCatalogFood.id,
        this.catalogQuantityGrams
      );
      this.selectedMealForFood = null;
    } finally {
      this.isSavingFood = false;
      this.cdr.markForCheck();
    }
  }

  async confirmAddManualFood() {
    if (this.isSavingFood || !this.selectedMealForFood || !this.newFoodName.trim() || !this.newFoodCalories) return;

    this.isSavingFood = true;
    try {
      await this.dietService.addFoodItem(
        this.selectedMealForFood.id,
        this.newFoodName,
        this.newFoodCalories,
        this.newFoodNote,
        this.newFoodProtein || 0,
        this.newFoodCarbs || 0,
        this.newFoodFat || 0
      );
      this.selectedMealForFood = null;
    } finally {
      this.isSavingFood = false;
      this.cdr.markForCheck();
    }
  }

  async deleteFoodItem(item: DietLogItem) {
    await this.dietService.deleteFoodItem(item.id);
  }

  async openEditFoodItem(item: DietLogItem) {
    this.editingFoodItem = item;
    this.editItemQuantityGrams = item.quantity_grams ?? null;
    this.editItemName = item.name;
    this.editItemCalories = item.calories;
    this.editItemNote = item.amount_note ?? '';
    this.editItemProtein = item.protein ?? 0;
    this.editItemCarbs = item.carbs ?? 0;
    this.editItemFat = item.fat ?? 0;
    this.editItemFood = item.food_id ? (await this.foodService.getFoodById(item.food_id)) ?? null : null;
    this.cdr.markForCheck();
  }

  closeEditFoodItem() {
    this.editingFoodItem = null;
  }

  get editItemPreview(): { calories: number; protein: number; carbs: number; fat: number } | null {
    if (!this.editItemFood || !this.editItemQuantityGrams) return null;
    const factor = this.editItemQuantityGrams / 100;
    return {
      calories: Math.round(this.editItemFood.kcal_100g * factor),
      protein: Math.round(this.editItemFood.protein_100g * factor * 10) / 10,
      carbs: Math.round(this.editItemFood.carbs_100g * factor * 10) / 10,
      fat: Math.round(this.editItemFood.fat_100g * factor * 10) / 10
    };
  }

  async confirmEditFoodItem() {
    if (this.isSavingItemEdit || !this.editingFoodItem) return;

    this.isSavingItemEdit = true;
    try {
      if (this.editingFoodItem.food_id) {
        if (!this.editItemQuantityGrams) return;
        await this.dietService.updateFoodItemQuantity(this.editingFoodItem.id, this.editItemQuantityGrams);
      } else {
        if (!this.editItemName.trim() || !this.editItemCalories) return;
        await this.dietService.updateFoodItemManual(
          this.editingFoodItem.id,
          this.editItemName,
          this.editItemCalories,
          this.editItemNote,
          this.editItemProtein ?? 0,
          this.editItemCarbs ?? 0,
          this.editItemFat ?? 0
        );
      }
      this.editingFoodItem = null;
    } finally {
      this.isSavingItemEdit = false;
      this.cdr.markForCheck();
    }
  }

  openAddMealModal() {
    this.isAddingMeal = true;
    this.newMealName = '';
  }

  async confirmAddMeal() {
    if (this.isSavingMeal || !this.newMealName.trim()) return;

    this.isSavingMeal = true;
    try {
      await this.dietService.addMeal(this.newMealName);
      this.isAddingMeal = false;
    } finally {
      this.isSavingMeal = false;
      this.cdr.markForCheck();
    }
  }

  async deleteMeal(meal: DietMealDetail) {
    if (confirm(`Sei sicuro di voler eliminare il pasto "${meal.name}"?`)) {
      await this.dietService.deleteMeal(meal.id);
    }
  }
}
