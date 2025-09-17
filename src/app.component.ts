import { Component, ChangeDetectionStrategy, signal, inject, effect, ElementRef, viewChild, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService, ValidationResponse } from './services/gemini.service';
import { StateService } from './services/state.service';
import * as d3 from 'd3';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly geminiService = inject(GeminiService);
  private readonly stateService = inject(StateService);

  // Module state from service
  currentModule = this.stateService.currentModule;
  problemStatement = this.stateService.problemStatement;
  actionPlanTasks = this.stateService.actionPlanTasks;
  hypothesis = this.stateService.hypothesis;
  experimentData = this.stateService.experimentData;
  analysis = this.stateService.analysis;
  conclusion = this.stateService.conclusion;

  // UI State
  question = signal('');
  validationResponse = signal<ValidationResponse | null>(null);
  isLoading = signal(false);
  newTask = signal('');
  showUndo = signal(false);
  private undoTimeout: any;
  newExperimentLabel = signal('');
  newExperimentValue = signal<number | null>(null);
  
  // D3 Chart
  chartContainer = viewChild<ElementRef>('chartContainer');

  constructor() {
    // Effect to draw chart when data or container changes
    effect(() => {
      const container = this.chartContainer();
      const data = this.experimentData();
      if (container && data) {
         untracked(() => this.drawChart(container.nativeElement, data));
      }
    });
  }

  // --- Module 1: Problem ---
  onQuestionInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.question.set(target.value);
    this.validationResponse.set(null);
  }

  async validateQuestion() {
    const currentQuestion = this.question().trim();
    if (!currentQuestion) return;
    
    this.isLoading.set(true);
    this.validationResponse.set(null);
    try {
      const response = await this.geminiService.validateMeasurableQuestion(currentQuestion);
      this.validationResponse.set(response);
      if (response.is_measurable) {
        this.stateService.setProblemStatement(currentQuestion);
        setTimeout(() => this.stateService.nextModule(), 2000);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Module 2: Plan ---
  addTask() {
    this.stateService.addTask(this.newTask().trim());
    this.newTask.set('');
  }

  removeTask(id: number) {
    this.stateService.removeTask(id);
    this.showUndo.set(true);
    clearTimeout(this.undoTimeout);
    this.undoTimeout = setTimeout(() => this.showUndo.set(false), 5000);
  }

  undoRemoveTask() {
    this.stateService.undoRemoveTask();
    this.showUndo.set(false);
    clearTimeout(this.undoTimeout);
  }

  // --- Module 3: Hypothesis ---
  onHypothesisInput(event: Event) {
    this.stateService.setHypothesis((event.target as HTMLTextAreaElement).value);
  }

  // --- Module 4: Experiment ---
  addExperimentDataPoint() {
    const label = this.newExperimentLabel().trim();
    const value = this.newExperimentValue();
    if (label && value !== null) {
      this.stateService.addExperimentDataPoint(label, value);
      this.newExperimentLabel.set('');
      this.newExperimentValue.set(null);
    }
  }

  removeExperimentDataPoint(id: number) {
    this.stateService.removeExperimentDataPoint(id);
  }

  private drawChart(container: HTMLElement, data: {label: string, value: number}[]) {
    d3.select(container).select('svg').remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 70, left: 40 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(container).append('svg')
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

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) ?? 0])
      .range([height, 0]);

    svg.append('g').call(d3.axisLeft(y));

    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => x(d.label)!)
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.value))
      .attr('fill', '#3b82f6');
  }

  // --- Module 5: Analysis & Conclusion ---
  onAnalysisInput(event: Event) {
    this.stateService.setAnalysis((event.target as HTMLTextAreaElement).value);
  }

  onConclusionInput(event: Event) {
    this.stateService.setConclusion((event.target as HTMLTextAreaElement).value);
  }
  
  // --- Final ---
  generateReport() {
    const reportHtml = this.stateService.generateReportHTML();
    const newWindow = window.open();
    newWindow?.document.write(reportHtml);
    newWindow?.document.close();
  }

  // --- Global Navigation ---
  goToModule(module: number) {
    this.stateService.goToModule(module);
  }
}
