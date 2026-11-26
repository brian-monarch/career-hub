export type LibraryQuestion = { text: string; category: "behavioral" | "leadership" | "product_sense" | "strategy" | "data" };

/** Starter library for Director-level product interviews. Questions he is actually asked get added in-app. */
export const QUESTION_LIBRARY: LibraryQuestion[] = [
  { category: "behavioral", text: "Tell me about yourself and why you're looking for a Director role now." },
  { category: "behavioral", text: "Tell me about the product decision you're proudest of. What did you decide, and what did you give up?" },
  { category: "behavioral", text: "Describe a time you disagreed with a senior leader on direction. What happened?" },
  { category: "behavioral", text: "Tell me about a launch that didn't go the way you planned. What did you change afterwards?" },
  { category: "behavioral", text: "Give me an example of when you pushed back on scope. How did you make the call?" },
  { category: "behavioral", text: "Tell me about a time you had to influence a team you had no authority over." },
  { category: "leadership", text: "How do you build and grow a team of product managers? Give me a specific person you developed." },
  { category: "leadership", text: "Tell me about a time you inherited a struggling team or program. What did you do in the first 90 days?" },
  { category: "leadership", text: "How do you set goals for a product team, and how do you know they're working?" },
  { category: "leadership", text: "Describe a hard performance conversation you had with someone on your team." },
  { category: "leadership", text: "How do you decide what your team will not do this quarter?" },
  { category: "strategy", text: "How would you build a product strategy for a platform with many internal and external customers?" },
  { category: "strategy", text: "Tell me about a time you made the case for an investment. How did you get it funded?" },
  { category: "strategy", text: "Where do you see this company's market going in the next three years, and what would you build for it?" },
  { category: "strategy", text: "How do you balance platform investments against features customers are asking for today?" },
  { category: "product_sense", text: "Pick a data or analytics product you use. What would you change and why?" },
  { category: "product_sense", text: "How would you design a self-serve reporting experience for advertisers?" },
  { category: "product_sense", text: "Walk me through how you'd decide whether to build, buy or partner for a measurement capability." },
  { category: "data", text: "How do you prove an advertising campaign actually caused incremental sales?" },
  { category: "data", text: "Tell me about a time the data told a different story than the business expected. What did you do?" },
  { category: "data", text: "How do you decide which metric a product team should own?" },
  { category: "data", text: "Explain a complex attribution or measurement concept to me as if I were a CMO." },
];

export const CATEGORY_LABEL: Record<LibraryQuestion["category"], string> = {
  behavioral: "Behavioral",
  leadership: "Leadership",
  strategy: "Strategy",
  product_sense: "Product sense",
  data: "Data & measurement",
};
