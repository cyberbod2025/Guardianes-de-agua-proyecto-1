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

  validationResponse: WritableSignal<ValidationResponse | null> = signal(null);
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

      const data = this.stateService.experimentData();
      if (this.stateService.currentModule() === 4 && this.chartContainer) {
          if (data.length > 0) {
              this.drawChart(data);
          } else {
              d3.select(this.chartContainer.nativeElement).select('svg').remove();
          }
      }
    });
  }

  onGroupSelect(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const group = selectElement.value;
    this.selectedGroup.set(group);
    this.selectedStudentName.set('');
    this.stateService.resetToInitialState();

    if (group) {
      this.studentsInGroup.set(this.studentService.getStudentsByGroup(group));
    } else {
      this.studentsInGroup.set([]);
    }
  }

  onStudentSelect(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const studentName = selectElement.value;
    this.selectedStudentName.set(studentName);
    
    const student = this.studentService.findStudentByName(studentName);
    if (student) {
        this.stateService.loadStateForTeam(student.team);
    } else {
        this.stateService.resetToInitialState();
    }
  }
  
  // Mision 1
  handleAddObservation() {
    this.stateService.addObservation(this.newObservationInput());
    this.newObservationInput.set('');
  }

  handleUpdateObservation(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.stateService.updateObservation(index, input.value);
  }

  async validateQuestion() {
    const question = this.problemStatementInput().trim();
    if (!question) return;

    this.isValidating.set(true);
    this.validationResponse.set(null);
    try {
      const response = await this.geminiService.validateMeasurableQuestion(question);
      this.validationResponse.set(response);
      if (response.is_measurable) {
        this.stateService.setProblemStatement(question);
      }
    } catch (error) {
      this.validationResponse.set({
        is_measurable: false,
        feedback: '¡Uy! Hubo un problema al conectar con la IA. Inténtalo de nuevo.'
      });
    } finally {
      this.isValidating.set(false);
    }
  }

  async getInspirationForProblem() {
    this.isGettingInspiration.set(true);
    this.inspirationResponse.set(null);
    try {
      const response = await this.geminiService.getInspiration(
        'Problemas de agua causados por lluvia en una comunidad escolar'
      );
      this.inspirationResponse.set(response);
    } catch (error) {
       this.inspirationResponse.set({
        ideas: ['Hubo un error al buscar inspiración. ¡Inténtalo de nuevo!']
      });
    } finally {
      this.isGettingInspiration.set(false);
    }
  }

  // Mision 2
  handleAddTask() {
    const materials = this.showOtherMaterials() ? this.newTaskMaterialsOther().trim() : this.newTaskMaterials();
    const role = this.showOtherRole() ? this.newTaskRoleOther().trim() : this.newTaskRole();

    const task: Omit<Task, 'id'> = {
      action: this.newTaskAction().trim(),
      materials: materials,
      role: role,
      time: this.newTaskTime().trim(),
      indicator: this.newTaskIndicator().trim()
    };
    if (task.action) {
      this.stateService.addTask(task);
      this.newTaskAction.set('');
      this.newTaskMaterials.set('');
      this.newTaskMaterialsOther.set('');
      this.newTaskRole.set('');
      this.newTaskRoleOther.set('');
      this.newTaskTime.set('');
      this.newTaskIndicator.set('');
    }
  }

  handleRemoveTask(taskId: number) {
    const removedTask = this.stateService.removeTask(taskId);
    if (removedTask) {
        this.lastRemovedTask.set(removedTask);
        setTimeout(() => this.lastRemovedTask.set(null), 5000); // Undo visible for 5s
    }
  }

  handleUndoRemoveTask() {
    this.stateService.undoRemoveTask();
    this.lastRemovedTask.set(null);
  }

  // Mision 4
  handleAddDataPoint() {
    const label = this.experimentLabelInput().trim();
    const value = this.experimentValueInput();
    if (label && value !== null && !isNaN(value)) {
      this.stateService.addExperimentDataPoint(label, value);
      this.experimentLabelInput.set('');
      this.experimentValueInput.set(null);
    }
  }

  // General Actions
  requestSaveAndExit() {
    this.showSummary.set(true);
  }

  cancelSaveAndExit() {
    this.showSummary.set(false);
  }

  confirmSaveAndExit() {
    this.showSummary.set(false);
    this.stateService.goToModule(0);
    this.selectedGroup.set('');
    this.selectedStudentName.set('');
    this.studentsInGroup.set([]);
  }

  generateReport() {
    const reportHtml = this.stateService.generateReportHTML();
    const reportWindow = window.open('', '_blank');
    reportWindow?.document.write(reportHtml);
    reportWindow?.document.close();
  }

  startOver() {
    if (confirm('¿Estás seguro de que quieres borrar todo el progreso de tu equipo? Esta acción no se puede deshacer.')) {
        this.stateService.clearStateForCurrentTeam();
        this.confirmSaveAndExit();
    }
  }

  exportProgress() {
    const stateJson = this.stateService.exportState();
    const blob = new Blob([stateJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GuardianesDelAgua-${this.stateService.teamName().replace(' ', '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  triggerImport() {
    this.fileInput.nativeElement.click();
  }

  importProgress(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        const success = this.stateService.importState(text);
        if (!success) {
          alert('Error: El archivo de progreso no es válido o está dañado.');
        }
      }
    };
    reader.readAsText(file);
    input.value = ''; // Reset file input
  }

  private drawChart(data: ExperimentData[]) {
    const element = this.chartContainer.nativeElement;
    d3.select(element).select('svg').remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    const svg = d3.select(element).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) ?? 0])
        .nice()
        .range([height, 0]);

    svg.append('g')
        .selectAll('rect')
        .data(data)
        .join('rect')
          .attr('x', d => x(d.label)!)
          .attr('y', d => y(d.value))
          .attr('width', x.bandwidth())
          .attr('height', d => height - y(d.value))
          .attr('fill', 'teal');

    const xAxis = (g: any) => g
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
          .style('text-anchor', 'end')
          .attr('dx', '-.8em')
          .attr('dy', '.15em')
          .attr('transform', 'rotate(-35)');
    
    const yAxis = (g: any) => g
        .call(d3.axisLeft(y));

    svg.append('g').call(xAxis);
    svg.append('g').call(yAxis);

    svg.selectAll('text').style('fill', '#334155'); // Dark slate for text
    svg.selectAll('.domain, .tick line').style('stroke', '#64748b'); // Medium slate for axes
  }
}