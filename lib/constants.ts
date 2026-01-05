import type { Theme } from "@react-navigation/native";

const NAV_FONT_FAMILY = "Inter-Black";

// HeyGen API Configuration
export const HEYGEN_API_KEY = process.env.EXPO_PUBLIC_HEYGEN_API_KEY || null;
export const HEYGEN_AVATAR_ID = process.env.EXPO_PUBLIC_HEYGEN_AVATAR_ID || "Angela-inblackskirt-20220820";
export const HEYGEN_VOICE_ID = process.env.EXPO_PUBLIC_HEYGEN_VOICE_ID || "1bd001e7e50f421d891986aad5158bc8";

// Lang Search API Configuration
export const LANG_SEARCH_API_KEY = process.env.EXPO_PUBLIC_LANG_SEARCH_API_KEY || null;

// Serper API Configuration
export const SERPER_API_KEY = process.env.EXPO_PUBLIC_SERPER_API_KEY || null;

export const NAV_THEME = {
  light: {
    background: "hsl(0 0% 100%)", // background
    border: "hsl(240 5.9% 90%)", // border
    card: "hsl(0 0% 100%)", // card
    notification: "hsl(0 84.2% 60.2%)", // destructive
    primary: "hsl(240 5.9% 10%)", // primary
    text: "hsl(240 10% 3.9%)", // foreground
  },
  dark: {
    background: "hsl(240 10% 3.9%)", // background
    border: "hsl(240 3.7% 15.9%)", // border
    card: "hsl(240 10% 3.9%)", // card
    notification: "hsl(0 72% 51%)", // destructive
    primary: "hsl(0 0% 98%)", // primary
    text: "hsl(0 0% 98%)", // foreground
  },
};

export const LIGHT_THEME: Theme = {
  dark: false,
  fonts: {
    regular: {
      fontFamily: NAV_FONT_FAMILY,
      fontWeight: "400",
    },
    medium: {
      fontFamily: NAV_FONT_FAMILY,
      fontWeight: "500",
    },
    bold: {
      fontFamily: NAV_FONT_FAMILY,
      fontWeight: "700",
    },
    heavy: {
      fontFamily: NAV_FONT_FAMILY,
      fontWeight: "800",
    },
  },
  colors: NAV_THEME.light,
};
export const DARK_THEME: Theme = {
  dark: true,
  fonts: {
    regular: {
      fontFamily: NAV_FONT_FAMILY,
      fontWeight: "400",
    },
    medium: {
      fontFamily: NAV_FONT_FAMILY,
      fontWeight: "500",
    },
    bold: {
      fontFamily: NAV_FONT_FAMILY,
      fontWeight: "700",
    },
    heavy: {
      fontFamily: NAV_FONT_FAMILY,
      fontWeight: "800",
    },
  },
  colors: NAV_THEME.dark,
};
