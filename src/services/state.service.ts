import { Injectable, signal, WritableSignal, computed, Signal } from '@angular/core';

export interface ExperimentData {
  id: number;
  label: string;
  value: number;
}

export interface Task {
  id: number;
  text: string;
}

export interface AppState {
  currentModule: number;
  problemStatement: string;
  actionPlanTasks: Task[];
  hypothesis: string;
  experimentData: ExperimentData[];
  analysis: string;
  conclusion: string;
}

const initialState: AppState = {
  currentModule: 0,
  problemStatement: '',
  actionPlanTasks: [],
  hypothesis: '',
  experimentData: [],
  analysis: '',
  conclusion: '',
};

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private readonly state: WritableSignal<AppState>;
  private lastDeletedTask: Task | null = null;
  private readonly storageKey = 'guardianesDelAguaState';

  // Public Signals from State
  currentModule: Signal<number>;
  problemStatement: Signal<string>;
  actionPlanTasks: Signal<Task[]>;
  hypothesis: Signal<string>;
  experimentData: Signal<ExperimentData[]>;
  analysis: Signal<string>;
  conclusion: Signal<string>;

  constructor() {
    const savedState = this.loadState();
    this.state = signal(savedState);

    this.currentModule = computed(() => this.state().currentModule);
    this.problemStatement = computed(() => this.state().problemStatement);
    this.actionPlanTasks = computed(() => this.state().actionPlanTasks);
    this.hypothesis = computed(() => this.state().hypothesis);
    this.experimentData = computed(() => this.state().experimentData);
    this.analysis = computed(() => this.state().analysis);
    this.conclusion = computed(() => this.state().conclusion);
  }

  // State Persistence
  private saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state()));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  private loadState(): AppState {
    try {
      const savedState = localStorage.getItem(this.storageKey);
      return savedState ? JSON.parse(savedState) : initialState;
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
      return initialState;
    }
  }
  
  // Navigation
  goToModule(moduleNumber: number) {
    this.state.update(s => ({ ...s, currentModule: moduleNumber }));
    this.saveState();
  }

  nextModule() {
    this.state.update(s => ({ ...s, currentModule: s.currentModule + 1 }));
    this.saveState();
  }

  // Module 1: Problem
  setProblemStatement(question: string) {
    this.state.update(s => ({ ...s, problemStatement: question }));
    this.saveState();
  }

  // Module 2: Plan
  addTask(text: string) {
    if (!text.trim()) return;
    this.state.update(s => ({
      ...s,
      actionPlanTasks: [...s.actionPlanTasks, { id: Date.now(), text }],
    }));
    this.saveState();
  }

  removeTask(taskId: number) {
    const taskToRemove = this.state().actionPlanTasks.find(t => t.id === taskId);
    if (taskToRemove) {
      this.lastDeletedTask = taskToRemove;
      this.state.update(s => ({
        ...s,
        actionPlanTasks: s.actionPlanTasks.filter(t => t.id !== taskId),
      }));
      this.saveState();
    }
    return this.lastDeletedTask;
  }

  undoRemoveTask() {
    if (this.lastDeletedTask) {
      this.state.update(s => ({
        ...s,
        actionPlanTasks: [...s.actionPlanTasks, this.lastDeletedTask!].sort((a,b) => a.id - b.id),
      }));
      this.lastDeletedTask = null;
      this.saveState();
    }
  }

  // Module 3: Hypothesis
  setHypothesis(text: string) {
    this.state.update(s => ({ ...s, hypothesis: text }));
    this.saveState();
  }

  // Module 4: Experiment
  addExperimentDataPoint(label: string, value: number) {
    if (!label.trim() || isNaN(value)) return;
    this.state.update(s => ({
      ...s,
      experimentData: [...s.experimentData, { id: Date.now(), label, value }],
    }));
    this.saveState();
  }
  
  removeExperimentDataPoint(id: number) {
     this.state.update(s => ({
      ...s,
      experimentData: s.experimentData.filter(d => d.id !== id),
    }));
    this.saveState();
  }

  // Module 5: Analysis & Conclusion
  setAnalysis(text: string) {
    this.state.update(s => ({ ...s, analysis: text }));
    this.saveState();
  }
  
  setConclusion(text: string) {
    this.state.update(s => ({ ...s, conclusion: text }));
    this.saveState();
  }

  // Final: Report
  generateReportHTML(): string {
    const state = this.state();
    const tasks = state.actionPlanTasks.map(t => `<li>${t.text}</li>`).join('');
    const data = state.experimentData.map(d => `<li>${d.label}: ${d.value}</li>`).join('');
    return `
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte de Misión: Guardianes del Agua</title>
      <style>body{font-family:sans-serif;line-height:1.6;padding:20px}h1,h2{color:#0056b3}</style></head>
      <body>
        <h1>Reporte de Misión: Guardianes del Agua</h1>
        <h2>Módulo 1: Problema Investigado</h2><p>${state.problemStatement}</p>
        <h2>Módulo 2: Plan de Ataque</h2><ul>${tasks}</ul>
        <h2>Módulo 3: Hipótesis</h2><p>${state.hypothesis}</p>
        <h2>Módulo 4: Datos Recolectados</h2><ul>${data}</ul>
        <h2>Módulo 5: Análisis</h2><p>${state.analysis}</p>
        <h2>Módulo 6: Conclusión</h2><p>${state.conclusion}</p>
      </body></html>
    `;
  }
}