import { Injectable, signal, WritableSignal, computed, Signal } from '@angular/core';

export interface ExperimentData {
  id: number;
  label: string;
  value: number;
}

export interface Task {
  id: number;
  action: string;
  materials: string;
  role: string;
  time: string;
  indicator: string;
}

export interface AppState {
  currentModule: number;
  teamName: string;
  observations: string[]; // Changed from string to string[]
  problemStatement: string;
  actionPlanTasks: Task[];
  hypothesis: string;
  experimentData: ExperimentData[];
  analysis: string;
  conclusion: string;
}

const initialState: AppState = {
  currentModule: 0,
  teamName: '',
  observations: [], // Changed to empty array
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
  private readonly storageKeyPrefix = 'guardianesDelAguaState_team_';
  private currentTeam = signal<number | null>(null);

  // Public Signals from State
  currentModule: Signal<number>;
  teamName: Signal<string>;
  observations: Signal<string[]>;
  problemStatement: Signal<string>;
  actionPlanTasks: Signal<Task[]>;
  hypothesis: Signal<string>;
  experimentData: Signal<ExperimentData[]>;
  analysis: Signal<string>;
  conclusion: Signal<string>;

  constructor() {
    this.state = signal(initialState);

    this.currentModule = computed(() => this.state().currentModule);
    this.teamName = computed(() => this.state().teamName);
    this.observations = computed(() => this.state().observations);
    this.problemStatement = computed(() => this.state().problemStatement);
    this.actionPlanTasks = computed(() => this.state().actionPlanTasks);
    this.hypothesis = computed(() => this.state().hypothesis);
    this.experimentData = computed(() => this.state().experimentData);
    this.analysis = computed(() => this.state().analysis);
    this.conclusion = computed(() => this.state().conclusion);
  }

  // State Persistence per Team
  private saveState() {
    const team = this.currentTeam();
    if (!team) return;
    try {
      const key = this.storageKeyPrefix + team;
      localStorage.setItem(key, JSON.stringify(this.state()));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  loadStateForTeam(teamNumber: number) {
    this.currentTeam.set(teamNumber);
    try {
      const key = this.storageKeyPrefix + teamNumber;
      const savedState = localStorage.getItem(key);
      const loadedState = savedState 
        ? JSON.parse(savedState) 
        : { ...initialState, teamName: `Equipo ${teamNumber}`, currentModule: 1 };
      this.state.set(loadedState);
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
      this.state.set({ ...initialState, teamName: `Equipo ${teamNumber}`, currentModule: 1 });
    }
  }

  clearStateForCurrentTeam() {
    const team = this.currentTeam();
    if (team) {
      try {
        const key = this.storageKeyPrefix + team;
        localStorage.removeItem(key);
      } catch (e) {
        console.error('Failed to remove state from localStorage', e);
      }
    }
    this.resetToInitialState();
  }
  
  getState(): AppState {
    return this.state();
  }

  resetToInitialState() {
    this.currentTeam.set(null);
    this.state.set(initialState);
  }

  // Import / Export
  exportState(): string {
    return JSON.stringify(this.state(), null, 2);
  }
  
  importState(jsonString: string): boolean {
    try {
      const importedState = JSON.parse(jsonString) as AppState;
      // Basic validation
      if (typeof importedState.currentModule !== 'number' || !importedState.teamName) {
        throw new Error('Invalid state file format');
      }
      const teamMatch = importedState.teamName.match(/Equipo (\d+)/);
      if (teamMatch && teamMatch[1]) {
        const teamNumber = parseInt(teamMatch[1], 10);
        this.currentTeam.set(teamNumber);
        this.state.set(importedState);
        this.saveState();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to import state", e);
      return false;
    }
  }
  
  // Navigation
  goToModule(moduleNumber: number) {
    if (moduleNumber === 0) {
        // Exiting the mission, reset state to initial but don't clear storage
        this.resetToInitialState();
    } else {
        this.state.update(s => ({ ...s, currentModule: moduleNumber }));
        this.saveState();
    }
  }

  nextModule() {
    this.state.update(s => ({ ...s, currentModule: s.currentModule + 1 }));
    this.saveState();
  }

  // Module 1: Problem
  setTeamName(name: string) {
    this.state.update(s => ({ ...s, teamName: name }));
    this.saveState();
  }

  addObservation(text: string) {
    if (!text.trim()) return;
    this.state.update(s => ({ ...s, observations: [...s.observations, text.trim()] }));
    this.saveState();
  }

  updateObservation(index: number, text: string) {
    this.state.update(s => {
      const newObservations = [...s.observations];
      if (newObservations[index] !== undefined) {
        newObservations[index] = text;
      }
      return { ...s, observations: newObservations };
    });
    this.saveState();
  }

  removeObservation(index: number) {
    this.state.update(s => ({
      ...s,
      observations: s.observations.filter((_, i) => i !== index)
    }));
    this.saveState();
  }
  
  setProblemStatement(question: string) {
    this.state.update(s => ({ ...s, problemStatement: question }));
    this.saveState();
  }

  // Module 2: Plan
  addTask(task: Omit<Task, 'id'>) {
    if (!task.action.trim()) return;
    this.state.update(s => ({
      ...s,
      actionPlanTasks: [...s.actionPlanTasks, { id: Date.now(), ...task }],
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
    const observations = state.observations.map(o => `<li>${o}</li>`).join('');
    const tasks = state.actionPlanTasks.map(t => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${t.action}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${t.materials}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${t.role}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${t.time}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${t.indicator}</td>
      </tr>
    `).join('');
    const data = state.experimentData.map(d => `<li>${d.label}: ${d.value}</li>`).join('');
    return `
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte de Misión: Guardianes del Agua</title>
      <style>body{font-family:sans-serif;line-height:1.6;padding:20px}h1,h2{color:#0056b3}table{width:100%;border-collapse:collapse;}th,td{text-align:left;}</style></head>
      <body>
        <h1>Reporte de Misión: Guardianes del Agua</h1>
        <h2>Equipo: ${state.teamName}</h2>
        <h2>Módulo 1: Problema Investigado</h2>
        <h3>Observaciones Iniciales:</h3><ul>${observations}</ul>
        <h3>Pregunta de Investigación:</h3><p>${state.problemStatement}</p>
        <h2>Módulo 2: Plan de Ataque</h2>
        <table style="width:100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px;">Acción</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Materiales</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Responsable</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Tiempo</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Indicador</th>
            </tr>
          </thead>
          <tbody>${tasks}</tbody>
        </table>
        <h2>Módulo 3: Hipótesis</h2><p>${state.hypothesis}</p>
        <h2>Módulo 4: Datos Recolectados</h2><ul>${data}</ul>
        <h2>Módulo 5: Análisis</h2><p>${state.analysis}</p>
        <h2>Módulo 6: Conclusión</h2><p>${state.conclusion}</p>
      </body></html>
    `;
  }
}