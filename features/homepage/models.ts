export interface HomepageImage {
  src: string;
  alt: string;
  focalX: number;
  focalY: number;
}

export interface HomepageSettings {
  names: string;
  date: string;
  venue: string;
  welcomeMessage: string;
  heroEyebrow: string;
  heroTitleSuffix: string;
  backgroundMode: "image" | "color";
  backgroundColor: string;
  image: HomepageImage | null;
}
