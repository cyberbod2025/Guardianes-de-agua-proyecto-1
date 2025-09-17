import { Component, ChangeDetectionStrategy, inject, signal, WritableSignal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { StateService, Task, ExperimentData, AppState } from './services/state.service';
import { GeminiService, ValidationResponse, InspirationResponse } from './services/gemini.service';
import { StudentService, Student } from './services/student.service';
import * as d3 from 'd3';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  stateService = inject(StateService);
  geminiService = inject(GeminiService);
  studentService = inject(StudentService);

  // Signals for local component state and inputs
  allGroups = signal<string[]>([]);
  selectedGroup = signal('');
  studentsInGroup = signal<Student[]>([]);
  selectedStudentName = signal('');
  
  selectedStudentInfo = computed(() => {
    const name = this.selectedStudentName();
    return name ? this.studentService.findStudentByName(name) : null;
  });

  teamMembers = computed(() => {
    const student = this.selectedStudentInfo();
    if (student) {
      return this.studentService.getTeamMembers(student.team);
    }
    return [];
  });

  newObservationInput = signal('');
  problemStatementInput = signal(this.stateService.problemStatement());

  validationResponse = signal<ValidationResponse | null>(null);
  isValidating = signal(false);
  
  // Inspiration signals
  inspirationResponse = signal<InspirationResponse | null>(null);
  isGettingInspiration = signal(false);

  // Signals for the new complex task
  newTaskAction = signal('');
  newTaskMaterials = signal('');
  newTaskMaterialsOther = signal('');
  showOtherMaterials = computed(() => this.newTaskMaterials() === 'Otro');
  newTaskRole = signal('');
  newTaskRoleOther = signal('');
  showOtherRole = computed(() => this.newTaskRole() === 'Otro');
  newTaskTime = signal('');
  newTaskIndicator = signal('');

  lastRemovedTask: WritableSignal<Task | null> = signal(null);
  showUndo = computed(() => this.lastRemovedTask() !== null);
  expandedTasks = signal(new Set<number>());

  hypothesisInput = signal(this.stateService.hypothesis());

  experimentLabelInput = signal('');
  experimentValueInput = signal<number | null>(null);

  analysisInput = signal(this.stateService.analysis());
  conclusionInput = signal(this.stateService.conclusion());
  
  // Summary screen state
  showSummary = signal(false);
  missionSummary = computed(() => {
    const state: AppState = this.stateService.getState();
    const completed: string[] = [];
    const pending: string[] = [];

    if (state.observations.length > 0) completed.push('✅ Lluvia de ideas inicial');
    else pending.push('✏️ Realizar la lluvia de ideas inicial');
    
    if (state.problemStatement) completed.push('✅ Pregunta de investigación definida');
    else pending.push('✏️ Definir la pregunta de investigación');
    
    if (state.actionPlanTasks.length > 0) completed.push('✅ Plan de acción creado');
    else pending.push('✏️ Crear el plan de acción');
    
    if (state.hypothesis) completed.push('✅ Hipótesis formulada');
    else pending.push('✏️ Formular una hipótesis');
    
    if (state.experimentData.length > 0) completed.push('✅ Datos del experimento recolectados');
    else pending.push('✏️ Recolectar datos del experimento');
    
    if (state.analysis) completed.push('✅ Análisis de resultados escrito');
    else pending.push('✏️ Escribir el análisis de resultados');
    
    if (state.conclusion) completed.push('✅ Conclusión de la misión escrita');
    else pending.push('✏️ Escribir la conclusión de la misión');

    return { completed, pending };
  });


  // D3 Chart
  @ViewChild('chartContainer') chartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  constructor() {
    this.allGroups.set(this.studentService.getGroups());

    effect(() => {
      // Sync local signal with state changes when a new team is loaded
      this.problemStatementInput.set(this.stateService.problemStatement());
      this.hypothesisInput.set(this.state