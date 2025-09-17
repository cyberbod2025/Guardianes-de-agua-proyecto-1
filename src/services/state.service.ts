import { Injectable, signal, WritableSignal, Signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private readonly _approvedQuestions: WritableSignal<string[]> = signal([]);

  public readonly approvedQuestions: Signal<string[]> = this._approvedQuestions.asReadonly();

  addApprovedQuestion(question: string) {
    this._approvedQuestions.update(questions => [...new Set([...questions, question])]);
  }
}
