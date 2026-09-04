import type { VerticalKnowledgeDefinition } from "./types";

export const tutorKnowledge: VerticalKnowledgeDefinition = {
  vertical: "tutor",
  keywords: [
    "tuition",
    "tuitions",
    "tutor",
    "tutoring",
    "teacher",
    "teaching",
    "classes",
    "coaching",
    "maths",
    "math",
    "science",
    "english",
    "physics",
    "chemistry",
    "biology",
    "exam",
    "exams",
    "homework",
    "student",
    "students",
    "children",
    "school",
  ],
  aliases: {
    "tution": "tuition",
    "tutions": "tuitions",
    "childrens": "children",
    "englis": "english",
    "techer": "teacher",
  },
  suggestedAttributes: [
    { key: "subjects", label: "Subjects" },
    { key: "class_levels", label: "Class levels" },
    { key: "mode", label: "Online or in-person" },
  ],
  suggestedOperatingPreferences: [
    { key: "scheduling", label: "Fixed schedule" },
    { key: "fees_structure", label: "Monthly fees" },
  ],
  followUpPrompts: [
    { key: "subjects_matter", prompt: "Do you teach more than one subject?" },
    { key: "class_levels_matter", prompt: "Do you teach more than one class level?" },
  ],
};
