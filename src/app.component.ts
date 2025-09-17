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
      this.hypothesisInput.set(this.stateService.hypothesis());
      this.analysisInput.set(this.stateService.analysis());
      this.conclusionInput.set(this.stateService.conclusion());
      
      // Draw chart when experiment data changes
      const data = this.stateService.experimentData();
      if (data.length > 0 && this.chartContainer) {
        this.drawChart(data);
      }
    });
  }

  // --- Event Handlers for Inputs ---
  onProblemStatementInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.problemStatementInput.set(target.value);
    this.validationResponse.set(null); // Reset validation on new input
  }

  onNewTaskActionInput(event: Event) {
    this.newTaskAction.set((event.target as HTMLInputElement).value);
  }

  onNewTaskMaterialsChange(event: Event) {
    this.newTaskMaterials.set((event.target as HTMLSelectElement).value);
  }

  onNewTaskMaterialsOtherInput(event: Event) {
    this.newTaskMaterialsOther.set((event.target as HTMLInputElement).value);
  }

  onNewTaskRoleChange(event: Event) {
    this.newTaskRole.set((event.target as HTMLSelectElement).value);
  }
  
  onNewTaskRoleOtherInput(event: Event) {
    this.newTaskRoleOther.set((event.target as HTMLInputElement).value);
  }

  onNewTaskTimeInput(event: Event) {
    this.newTaskTime.set((event.target as HTMLInputElement).value);
  }

  onNewTaskIndicatorInput(event: Event) {
    this.newTaskIndicator.set((event.target as HTMLInputElement).value);
  }
  
  onHypothesisInput(event: Event) {
      this.hypothesisInput.set((event.target as HTMLTextAreaElement).value);
  }

  onExperimentLabelInput(event: Event) {
    this.experimentLabelInput.set((event.target as HTMLInputElement).value);
  }

  onExperimentValueInput(event: Event) {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.experimentValueInput.set(isNaN(value) ? null : value);
  }

  onAnalysisInput(event: Event) {
    this.analysisInput.set((event.target as HTMLTextAreaElement).value);
  }

  onConclusionInput(event: Event) {
    this.conclusionInput.set((event.target as HTMLTextAreaElement).value);
  }

  // --- Component Logic Methods ---

  onGroupSelect(event: Event) {
    const group = (event.target as HTMLSelectElement).value;
    this.selectedGroup.set(group);
    this.studentsInGroup.set(
      group ? this.studentService.getStudentsByGroup(group) : []
    );
    this.selectedStudentName.set('');
  }

  onStudentSelect(event: Event) {
    const name = (event.target as HTMLSelectElement).value;
    this.selectedStudentName.set(name);
    const student = this.studentService.findStudentByName(name);
    if (student) {
        this.stateService.loadStateForTeam(student.team);
    }
  }

  handleAddObservation() {
    this.stateService.addObservation(this.newObservationInput());
    this.newObservationInput.set('');
  }
  
  handleUpdateObservation(index: number, event: Event) {
    const newText = (event.target as HTMLInputElement).value;
    this.stateService.updateObservation(index, newText);
  }

  async validateQuestion() {
    const question = this.problemStatementInput();
    if (!question.trim()) return;
    this.isValidating.set(true);
    this.inspirationResponse.set(null);
    try {
        const response = await this.geminiService.validateMeasurableQuestion(question);
        this.validationResponse.set(response);
        if (response.is_measurable) {
            this.stateService.setProblemStatement(question);
        }
    } finally {
        this.isValidating.set(false);
    }
  }

  async getInspirationForProblem() {
    this.isGettingInspiration.set(true);
    this.validationResponse.set(null);
    try {
        const response = await this.geminiService.getInspiration('problemas con agua de lluvia en una escuela');
        this.inspirationResponse.set(response);
    } finally {
        this.isGettingInspiration.set(false);
    }
  }

  handleAddTask() {
    const task: Omit<Task, 'id'> = {
      action: this.newTaskAction(),
      materials: this.showOtherMaterials() ? this.newTaskMaterialsOther() : this.newTaskMaterials(),
      role: this.showOtherRole() ? this.newTaskRoleOther() : this.newTaskRole(),
      time: this.newTaskTime(),
      indicator: this.newTaskIndicator(),
    };
    this.stateService.addTask(task);
    
    // Reset form fields
    this.newTaskAction.set('');
    this.newTaskMaterials.set('');
    this.newTaskMaterialsOther.set('');
    this.newTaskRole.set('');
    this.newTaskRoleOther.set('');
    this.newTaskTime.set('');
    this.newTaskIndicator.set('');
  }

  handleRemoveTask(taskId: number) {
    const removed = this.stateService.removeTask(taskId);
    if(removed) {
        this.lastRemovedTask.set(removed);
        setTimeout(() => this.lastRemovedTask.set(null), 5000); // Undo disappears after 5s
    }
  }

  handleUndoRemoveTask() {
    this.stateService.undoRemoveTask();
    this.lastRemovedTask.set(null);
  }
  
  toggleTask(taskId: number) {
    this.expandedTasks.update(currentSet => {
      const newSet = new Set(currentSet);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }
  
  handleAddDataPoint() {
    const label = this.experimentLabelInput();
    const value = this.experimentValueInput();
    if (label && value !== null) {
      this.stateService.addExperimentDataPoint(label, value);
      this.experimentLabelInput.set('');
      this.experimentValueInput.set(null);
    }
  }
  
  private drawChart(data: ExperimentData[]) {
    const chartElement = this.chartContainer.nativeElement;
    d3.select(chartElement).selectAll('*').remove(); // Clear previous chart

    const margin = { top: 20, right: 20, bottom: 50, left: 40 };
    const width = chartElement.clientWidth - margin.left - margin.right;
    const height = chartElement.clientHeight - margin.top - margin.bottom;

    const svg = d3.select(chartElement).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d.label))
      .padding(0.2);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end');

    const yMax = d3.max(data, d => d.value) || 0;
    const y = d3.scaleLinear()
      .domain([0, yMax * 1.1]) // Add 10% padding to y-axis
      .range([height, 0]);

    svg.append('g').call(d3.axisLeft(y));

    svg.selectAll('mybar')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => x(d.label)!)
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.value))
      .attr('fill', '#22d3ee'); // A cyan color
  }
  
  requestSaveAndExit() {
    this.showSummary.set(true);
  }

  cancelSaveAndExit() {
    this.showSummary.set(false);
  }
  
  confirmSaveAndExit() {
    this.showSummary.set(false);
    this.stateService.goToModule(0); // This resets state but doesn't clear storage
  }
  
  startOver() {
    if (confirm('¿Estás seguro? Se borrará todo el progreso de este equipo y no se podrá recuperar.')) {
        this.stateService.clearStateForCurrentTeam();
        this.showSummary.set(false);
        this.stateService.goToModule(0);
    }
  }

  exportProgress() {
    const stateJson = this.stateService.exportState();
    const blob = new Blob([stateJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guardianes_del_agua_${this.stateService.teamName().replace(/\s/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importProgress(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        if(this.stateService.importState(jsonString)) {
           console.log("State imported successfully");
        } else {
           alert("Error: El archivo de progreso no tiene el formato correcto.");
        }
      } catch (err) {
        console.error("Failed to parse imported file", err);
        alert("Error al leer el archivo. Asegúrate de que es un archivo de progreso válido.");
      }
    };
    reader.readAsText(file);
  }
  
  triggerImport() {
    this.fileInput.nativeElement.click();
  }

  generateReport() {
    const reportHtml = this.stateService.generateReportHTML();
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    URL.revokeObjectURL(url);
  }
}
