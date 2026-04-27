"use client";

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type LessonPlanPdfMeta = {
  teacherName: string;
  schoolName: string;
  lessonDate: string;
  subject: string;
  grade: string;
  topic: string;
  duration: string;
};

type Props = {
  lesson: unknown;
  meta: LessonPlanPdfMeta;
};

type UnknownRecord = Record<string, unknown>;

type VocabularyRow = {
  word: string;
  meaning: string;
};

type LessonStepRow = {
  number: string;
  title: string;
  time: string;
  teacherActivity: string;
  learnerActivity: string;
  teachingMethod: string;
  assessmentCheck: string;
  learningPoint: string;
  guidedQuestions: string[];
};

type LabelValueRow = {
  label: string;
  value: string;
};

type EvaluationRow = {
  question: string;
  markingGuide: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return asText(record.text ?? record.value ?? record.item ?? record.question ?? record.q);
      }
      return "";
    })
    .filter(Boolean);
}

function getLessonTitle(lessonPlan: UnknownRecord, meta: LessonPlanPdfMeta) {
  return (
    asText(lessonPlan?.lessonTitle) ||
    asText(lessonPlan?.title) ||
    asText(lessonPlan?.topic) ||
    meta.topic ||
    "Lesson Plan"
  );
}

function getVocabulary(lessonPlan: UnknownRecord): VocabularyRow[] {
  const items = Array.isArray(lessonPlan?.keyVocabulary) ? lessonPlan.keyVocabulary : [];
  return items
    .map((item: unknown) => {
      const record = getRecord(item);
      return {
        word: asText(record.word ?? record.term),
        meaning: asText(record.simpleMeaning ?? record.meaning ?? record.definition),
      };
    })
    .filter((item) => item.word || item.meaning);
}

function getEvaluationItems(lessonPlan: UnknownRecord): EvaluationRow[] {
  const items = Array.isArray(lessonPlan?.evaluation) ? lessonPlan.evaluation : [];
  return items
    .map((item: unknown) => {
      if (typeof item === "string") {
        return { question: item.trim(), markingGuide: "" };
      }
      const record = getRecord(item);
      return {
        question: asText(record.question ?? record.q ?? record.prompt),
        markingGuide: asText(record.markingGuide ?? record.answerGuide ?? record.guide),
      };
    })
    .filter((item) => item.question || item.markingGuide);
}

function getSteps(lessonPlan: UnknownRecord): LessonStepRow[] {
  const steps = Array.isArray(lessonPlan?.steps) ? lessonPlan.steps : [];
  return steps.map((step: unknown, index: number) => {
    const record = getRecord(step);
    return {
      number: asText(record.stepNumber ?? record.step) || String(index + 1),
      title: asText(record.stepTitle ?? record.title) || "Lesson Step",
      time: asText(record.timeMinutes) ? `${asText(record.timeMinutes)} minutes` : "",
      teacherActivity: asText(record.teacherActivity),
      learnerActivity: asText(record.learnerActivity),
      teachingMethod: asText(record.teachingMethod),
      assessmentCheck: asText(record.assessmentCheck),
      learningPoint: asText(record.concretisedLearningPoint ?? record.learningPoint),
      guidedQuestions: asList(record.guidedQuestions),
    };
  });
}

function getDifferentiation(lessonPlan: UnknownRecord): LabelValueRow[] {
  const diff = lessonPlan?.differentiation;
  if (!isRecord(diff)) return [];

  return [
    ["Support for Struggling Learners", diff.supportForStrugglingLearners ?? diff.support],
    ["Support for Average Learners", diff.supportForAverageLearners],
    ["Challenge for Advanced Learners", diff.challengeForAdvancedLearners ?? diff.extension],
  ]
    .map(([label, value]) => ({ label: String(label), value: asText(value) }))
    .filter((item) => item.value);
}

function formatDate(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function List({ items }: { items: string[] }) {
  if (!items.length) return <Text style={styles.empty}>Not specified.</Text>;
  return (
    <View>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.listItem}>
          <Text style={styles.bullet}>{index + 1}.</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.stepField}>
      <Text style={styles.stepLabel}>{label}: </Text>
      <Text style={styles.stepValue}>{value}</Text>
    </View>
  );
}

export function LessonPlanPdfDocument({ lesson, meta }: Props) {
  const lessonRecord = getRecord(lesson);
  const lessonPlan = getRecord(lessonRecord.lessonPlan);
  const lessonTitle = getLessonTitle(lessonPlan, meta);
  const vocabulary = getVocabulary(lessonPlan);
  const steps = getSteps(lessonPlan);
  const differentiation = getDifferentiation(lessonPlan);
  const evaluation = getEvaluationItems(lessonPlan);

  return (
    <Document title={`${meta.subject}_${meta.grade}_${meta.topic}_LessonPlan`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.fixedHeader} fixed>
          <View>
            <Text style={styles.schoolName}>{meta.schoolName || "School Name"}</Text>
            <Text style={styles.teacherLine}>Teacher: {meta.teacherName || "Teacher Name"}</Text>
          </View>
          <Text style={styles.brand}>LessonForge</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text style={styles.documentTitle}>Lesson Plan</Text>
            <Text style={styles.lessonTitle}>{lessonTitle}</Text>
          </View>

          <View style={styles.headerGrid}>
            <View style={styles.headerCell}>
              <Text style={styles.headerLabel}>Subject</Text>
              <Text style={styles.headerValue}>{meta.subject || "Not specified"}</Text>
            </View>
            <View style={styles.headerCell}>
              <Text style={styles.headerLabel}>Class / Grade</Text>
              <Text style={styles.headerValue}>{meta.grade || "Not specified"}</Text>
            </View>
            <View style={styles.headerCell}>
              <Text style={styles.headerLabel}>Date</Text>
              <Text style={styles.headerValue}>{formatDate(meta.lessonDate) || "Not specified"}</Text>
            </View>
            <View style={styles.headerCell}>
              <Text style={styles.headerLabel}>Duration</Text>
              <Text style={styles.headerValue}>{meta.duration || "Not specified"}</Text>
            </View>
          </View>

          <Section title="Performance Objectives">
            <List items={asList(lessonPlan.performanceObjectives)} />
          </Section>

          <Section title="Success Criteria">
            <List items={asList(lessonPlan.successCriteria)} />
          </Section>

          <Section title="Instructional Materials">
            <List items={asList(lessonPlan.instructionalMaterials)} />
          </Section>

          <Section title="Previous Knowledge">
            <Text style={styles.paragraph}>{asText(lessonPlan.previousKnowledge) || "Not specified."}</Text>
          </Section>

          <Section title="Introduction">
            <Text style={styles.paragraph}>{asText(lessonPlan.introduction) || "Not specified."}</Text>
          </Section>

          <Section title="Key Vocabulary">
            {vocabulary.length ? (
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.wordCell]}>Word</Text>
                  <Text style={styles.tableCell}>Meaning</Text>
                </View>
                {vocabulary.map((item, index) => (
                  <View key={`${item.word}-${index}`} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCell, styles.wordCell]}>{item.word}</Text>
                    <Text style={styles.tableCell}>{item.meaning}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>Not specified.</Text>
            )}
          </Section>

          <Section title="Lesson Delivery Steps">
            {steps.length ? (
              steps.map((step, index) => (
                <View key={`${step.number}-${index}`} style={styles.stepCard} wrap={false}>
                  <Text style={styles.stepTitle}>
                    Step {step.number}: {step.title}
                  </Text>
                  <Field label="Time" value={step.time} />
                  <Field label="Teacher Activity" value={step.teacherActivity} />
                  <Field label="Learner Activity" value={step.learnerActivity} />
                  <Field label="Teaching Method" value={step.teachingMethod} />
                  <Field label="Assessment Check" value={step.assessmentCheck} />
                  <Field label="Learning Point" value={step.learningPoint} />
                  {step.guidedQuestions.length ? (
                    <View style={styles.guidedBlock}>
                      <Text style={styles.stepLabel}>Guided Questions:</Text>
                      <List items={step.guidedQuestions} />
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Not specified.</Text>
            )}
          </Section>

          <Section title="Differentiation">
            {differentiation.length ? (
              differentiation.map((item) => (
                <View key={item.label} style={styles.diffRow}>
                  <Text style={styles.diffLabel}>{item.label}</Text>
                  <Text style={styles.paragraph}>{item.value}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Not specified.</Text>
            )}
          </Section>

          <Section title="Board Summary">
            <List items={asList(lessonPlan.boardSummary)} />
          </Section>

          <Section title="Evaluation Questions">
            {evaluation.length ? (
              evaluation.map((item, index) => (
                <View key={`${item.question}-${index}`} style={styles.evalItem} wrap={false}>
                  <Text style={styles.evalQuestion}>
                    {index + 1}. {item.question || "Question not specified"}
                  </Text>
                  {item.markingGuide ? (
                    <Text style={styles.markingGuide}>Marking Guide: {item.markingGuide}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Not specified.</Text>
            )}
          </Section>

          <Section title="Exit Ticket">
            <List items={asList(lessonPlan.exitTicket)} />
          </Section>

          <Section title="Assignment">
            <List items={asList(lessonPlan.assignment)} />
          </Section>
        </View>

        <View style={styles.fixedFooter} fixed>
          <Text style={styles.footerText}>Confidential — For School Submission</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 74,
    paddingRight: 42,
    paddingBottom: 54,
    paddingLeft: 42,
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: "#000",
    lineHeight: 1.35,
  },
  fixedHeader: {
    position: "absolute",
    top: 24,
    left: 42,
    right: 42,
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  schoolName: {
    fontSize: 11,
    fontFamily: "Times-Bold",
  },
  teacherLine: {
    marginTop: 3,
    fontSize: 10,
  },
  brand: {
    fontSize: 9,
    color: "#444",
  },
  content: {
    width: "100%",
  },
  titleBlock: {
    alignItems: "center",
    marginBottom: 12,
  },
  documentTitle: {
    fontSize: 16,
    fontFamily: "Times-Bold",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  lessonTitle: {
    fontSize: 13,
    fontFamily: "Times-Bold",
    textAlign: "center",
  },
  headerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    marginBottom: 12,
  },
  headerCell: {
    width: "50%",
    padding: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
  },
  headerLabel: {
    fontSize: 9,
    fontFamily: "Times-Bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerValue: {
    fontSize: 11,
  },
  section: {
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Times-Bold",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    paddingBottom: 2,
    marginBottom: 5,
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.35,
  },
  empty: {
    fontSize: 11,
    fontStyle: "italic",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bullet: {
    width: 18,
    fontSize: 11,
  },
  listText: {
    flex: 1,
    fontSize: 11,
  },
  table: {
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
  },
  tableHeader: {
    backgroundColor: "#eee",
  },
 tableCell: {
  flex: 1,
  padding: 5,
  borderRightWidth: 1,
  borderRightColor: "#000",
  borderRightStyle: "solid",
  fontSize: 11,
  lineHeight: 1.25,
},
  wordCell: {
    width: "38%",
    flexGrow: 0,
    flexShrink: 0,
    fontFamily: "Times-Bold",
  },
  stepCard: {
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    padding: 7,
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 11,
    fontFamily: "Times-Bold",
    marginBottom: 4,
  },
  stepField: {
    flexDirection: "row",
    marginBottom: 3,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: "Times-Bold",
  },
  stepValue: {
    flex: 1,
    fontSize: 11,
  },
  guidedBlock: {
    marginTop: 3,
  },
  diffRow: {
    marginBottom: 5,
  },
  diffLabel: {
    fontSize: 11,
    fontFamily: "Times-Bold",
    marginBottom: 2,
  },
  evalItem: {
    marginBottom: 7,
  },
  evalQuestion: {
    fontSize: 11,
  },
  markingGuide: {
    marginTop: 3,
    padding: 5,
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    fontSize: 11,
  },
  fixedFooter: {
    position: "absolute",
    left: 42,
    right: 42,
    bottom: 22,
    borderTopWidth: 1,
    borderTopColor: "#000",
    borderTopStyle: "solid",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 9,
  },
  pageNumber: {
    fontSize: 9,
  },
});
