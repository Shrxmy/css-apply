export interface Question {
  id: number;
  text: string;
  dominant: string | string[];
  average?: string[];
  less?: string[];
}

export type Answers = {
  [key: number]: number;
};

export type CommitteeName =
  | "Academics"
  | "Community Development"
  | "Creatives & Technical"
  | "Documentation"
  | "External Affairs"
  | "Finance"
  | "Logistics"
  | "Publicity"
  | "Sports & Talent"
  | "Technology Development";
