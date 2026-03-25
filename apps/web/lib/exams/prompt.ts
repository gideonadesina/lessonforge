import type { ExamBuilderInput } from "@/lib/exams/types";

export function buildExamGenerationPrompt(input: ExamBuilderInput) {
  const alignmentGuidance =
    input.examAlignment === "WAEC"
      ? "Use WAEC-style formal exam language, progression, and marking expectations."
      : input.examAlignment === "NECO"
        ? "Use NECO-style formal exam language, progression, and marking expectations."
        : "Use formal school exam language and balanced question progression.";

  return `
Return STRICT JSON only. No markdown. No backticks. No extra commentary.

Generate a formal, printable, teacher-ready exam for:
- Subject: ${input.subject}
- Topic/Coverage: ${input.topicOrCoverage}
- Class/Grade: ${input.classOrGrade}
- School Level: ${input.schoolLevel}
- Curriculum: ${input.curriculum}
- Exam Alignment: ${input.examAlignment}
- Exam Type: ${input.examType}
- Duration: ${input.durationMins} minutes
- Total Marks: ${input.totalMarks}
- Objective Questions Required: ${input.objectiveQuestionCount}
- Theory Questions Required: ${input.theoryQuestionCount}
- Difficulty: ${input.difficultyLevel}
- Extra teacher notes: ${input.specialNotes ?? "None"}

Tone and quality requirements:
- Must feel like a real formal exam paper (not worksheet/classwork phrasing).
- Keep wording classroom-usable and Nigerian school-reality aware.
- Use clear numbering and clean exam structure.
- Objective questions must use exactly 4 options each.
- Theory questions must include nested sub-questions where suitable (a, b, c...).
- Include meaningful, mark-aware suggested answers and marking points.
- Keep content age-appropriate for ${input.schoolLevel} / ${input.classOrGrade}.
- ${alignmentGuidance}

Output JSON shape exactly:
{
  "objectiveSection": {
    "questions": [
      {
        "number": 1,
        "questionText": "",
        "options": ["", "", "", ""],
        "answerLabel": "A",
        "marks": 1
      }
    ]
  },
  "theorySection": {
    "questions": [
      {
        "mainQuestionNumber": 1,
        "mainQuestionText": "",
        "subQuestions": [
          {
            "label": "a",
            "questionText": "",
            "marks": 2,
            "suggestedAnswer": "",
            "markingPoints": ["", ""]
          }
        ]
      }
    ]
  }
}

Hard constraints:
- objectiveSection.questions must be exactly ${input.objectiveQuestionCount} items.
- theorySection.questions must be exactly ${input.theoryQuestionCount} items.
- Each objective question must have exactly 4 options.
- answerLabel must be one of A, B, C, D.
- Each theory question must have at least one subQuestion.
- marks must be positive integers.
- Return JSON only.
`.trim();
}
