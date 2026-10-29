export const sampleMindMap = {
  title: "Dispatch map",
  root: {
    label: "Core idea",
    children: [
      {
        label: "Branch A",
        children: [{ label: "Leaf 1" }],
      },
    ],
  },
};

export const sampleReport = {
  title: "Briefing",
  summary: "Summary text.",
  sections: [
    { heading: "Section", body: "Body copy.", bullets: ["One"] },
  ],
  keyTakeaways: ["Takeaway"],
};

export const sampleSlideDeck = {
  title: "Deck",
  slides: [{ title: "Slide 1", bullets: ["Point"] }],
};

export const sampleFlashcards = {
  title: "Cards",
  cards: [{ front: "Q", back: "A" }],
};

export const sampleQuiz = {
  title: "Quiz",
  questions: [
    {
      prompt: "Pick one",
      choices: ["Wrong", "Right"],
      correctIndex: 1,
      explanation: "Because.",
    },
  ],
};

export const sampleDataTable = {
  title: "Table",
  description: "Desc",
  columns: ["Col A", "Col B"],
  rows: [["1", "2"]],
};
