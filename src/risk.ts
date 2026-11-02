export type RiskStudent = { attendance: number; marks: number }

export function isAtRisk(student: RiskStudent): boolean {
  return student.attendance < 75 || student.marks < 24
}
