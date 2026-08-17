export interface Question {
  id: string;
  type: "single" | "text";
  titleKey: string;
  optionsKey?: string[];
}

export const QUESTIONS: Question[] = [
  {
    id: "current_tool",
    type: "single",
    titleKey: "q1.title",
    optionsKey: ["q1.opt1", "q1.opt2", "q1.opt3", "q1.opt4", "q1.opt5"],
  },
  {
    id: "time_sink",
    type: "single",
    titleKey: "q2.title",
    optionsKey: ["q2.opt1", "q2.opt2", "q2.opt3", "q2.opt4", "q2.opt5"],
  },
  {
    id: "new_customer_flow",
    type: "text",
    titleKey: "q3.title",
  },
];
