import { Injectable } from '@angular/core';
import { STUDENTS } from '../data/student-data';

export interface Student {
  name: string;
  team: number;
  group: string;
}

@Injectable({
  providedIn: 'root',
})
export class StudentService {
  private students: Student[] = STUDENTS;

  getGroups(): string[] {
    const groups = this.students.map(s => s.group);
    return [...new Set(groups)].sort();
  }

  getStudentsByGroup(group: string): Student[] {
    return [...this.students]
        .filter(s => s.group === group)
        .sort((a, b) => a.name.localeCompare(b.name));
  }

  findStudentByName(name: string): Student | undefined {
    return this.students.find(s => s.name === name);
  }

  getTeamMembers(teamNumber: number): Student[] {
    return this.students.filter(s => s.team === teamNumber).sort((a, b) => a.name.localeCompare(b.name));
  }
}