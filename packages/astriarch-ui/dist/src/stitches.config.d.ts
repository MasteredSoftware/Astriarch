/// <reference types="react" />
export declare const styled: <Type extends import("@stitches/react/types/util").Function | keyof JSX.IntrinsicElements | import("react").ComponentType<any>, Composers extends (string | import("@stitches/react/types/util").Function | import("react").ComponentType<any> | {
    [name: string]: unknown;
})[], CSS = import("@stitches/react/types/css-util").CSS<{
    bp1: "(min-width: 575px)";
    bp2: "(min-width: 750px)";
}, {
    colors: {
        black: string;
        white: string;
        gray: string;
        blue: string;
        red: string;
        yellow: string;
        pink: string;
        turq: string;
        orange: string;
    };
    fonts: {
        sans: string;
    };
    fontSizes: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
        6: string;
    };
    space: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
        6: string;
    };
    sizes: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
        6: string;
    };
    radii: {
        1: string;
        2: string;
        3: string;
        round: string;
    };
    fontWeights: unknown;
    lineHeights: unknown;
    letterSpacings: unknown;
    borderWidths: unknown;
    borderStyles: unknown;
    shadows: unknown;
    zIndices: unknown;
    transitions: unknown;
}, import("@stitches/react/types/config").DefaultThemeMap, {}>>(type: Type, ...composers: { [K in keyof Composers]: string extends Composers[K] ? Composers[K] : Composers[K] extends string | import("@stitches/react/types/util").Function | import("react").ComponentType<any> ? Composers[K] : import("@stitches/react/types/stitches").RemoveIndex<CSS> & {
    variants?: {
        [x: string]: {
            [x: string]: CSS;
            [x: number]: CSS;
        };
    } | undefined;
    compoundVariants?: (("variants" extends keyof Composers[K] ? Composers[K][keyof Composers[K] & "variants"] extends infer T ? { [Name in keyof T]?: import("@stitches/react/types/util").String | import("@stitches/react/types/util").Widen<keyof Composers[K][keyof Composers[K] & "variants"][Name]> | undefined; } : never : import("@stitches/react/types/util").WideObject) & {
        css: CSS;
    })[] | undefined;
    defaultVariants?: ("variants" extends keyof Composers[K] ? Composers[K][keyof Composers[K] & "variants"] extends infer T_1 ? { [Name_1 in keyof T_1]?: import("@stitches/react/types/util").String | import("@stitches/react/types/util").Widen<keyof Composers[K][keyof Composers[K] & "variants"][Name_1]> | undefined; } : never : import("@stitches/react/types/util").WideObject) | undefined;
} & CSS & (Composers[K] extends infer T_2 ? { [K2 in keyof T_2]: K2 extends "compoundVariants" | "defaultVariants" | "variants" ? unknown : K2 extends keyof CSS ? CSS[K2] : unknown; } : never); }) => import("@stitches/react/types/styled-component").StyledComponent<Type, import("@stitches/react/types/styled-component").StyledComponentProps<Composers>, {
    bp1: "(min-width: 575px)";
    bp2: "(min-width: 750px)";
}, import("@stitches/react/types/css-util").CSS<{
    bp1: "(min-width: 575px)";
    bp2: "(min-width: 750px)";
}, {
    colors: {
        black: string;
        white: string;
        gray: string;
        blue: string;
        red: string;
        yellow: string;
        pink: string;
        turq: string;
        orange: string;
    };
    fonts: {
        sans: string;
    };
    fontSizes: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
        6: string;
    };
    space: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
        6: string;
    };
    sizes: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
        6: string;
    };
    radii: {
        1: string;
        2: string;
        3: string;
        round: string;
    };
    fontWeights: unknown;
    lineHeights: unknown;
    letterSpacings: unknown;
    borderWidths: unknown;
    borderStyles: unknown;
    shadows: unknown;
    zIndices: unknown;
    transitions: unknown;
}, import("@stitches/react/types/config").DefaultThemeMap, {}>>, createTheme: <Argument0 extends string | ({
    colors?: {
        black?: string | number | boolean | undefined;
        white?: string | number | boolean | undefined;
        gray?: string | number | boolean | undefined;
        blue?: string | number | boolean | undefined;
        red?: string | number | boolean | undefined;
        yellow?: string | number | boolean | undefined;
        pink?: string | number | boolean | undefined;
        turq?: string | number | boolean | undefined;
        orange?: string | number | boolean | undefined;
    } | undefined;
    fonts?: {
        sans?: string | number | boolean | undefined;
    } | undefined;
    fontSizes?: {
        1?: string | number | boolean | undefined;
        2?: string | number | boolean | undefined;
        3?: string | number | boolean | undefined;
        4?: string | number | boolean | undefined;
        5?: string | number | boolean | undefined;
        6?: string | number | boolean | undefined;
    } | undefined;
    space?: {
        1?: string | number | boolean | undefined;
        2?: string | number | boolean | undefined;
        3?: string | number | boolean | undefined;
        4?: string | number | boolean | undefined;
        5?: string | number | boolean | undefined;
        6?: string | number | boolean | undefined;
    } | undefined;
    sizes?: {
        1?: string | number | boolean | undefined;
        2?: string | number | boolean | undefined;
        3?: string | number | boolean | undefined;
        4?: string | number | boolean | undefined;
        5?: string | number | boolean | undefined;
        6?: string | number | boolean | undefined;
    } | undefined;
    radii?: {
        1?: string | number | boolean | undefined;
        2?: string | number | boolean | undefined;
        3?: string | number | boolean | undefined;
        round?: string | number | boolean | undefined;
    } | undefined;
    fontWeights?: {} | undefined;
    lineHeights?: {} | undefined;
    letterSpacings?: {} | undefined;
    borderWidths?: {} | undefined;
    borderStyles?: {} | undefined;
    shadows?: {} | undefined;
    zIndices?: {} | undefined;
    transitions?: {} | undefined;
} & {
    [x: string]: {
        [x: string]: string | number | boolean;
        [x: number]: string | number | boolean;
    };
}), Argument1 extends string | ({
    colors?: {
        black?: string | number | boolean | undefined;
        white?: string | number | boolean | undefined;
        gray?: string | number | boolean | undefined;
        blue?: string | number | boolean | undefined;
        red?: string | number | boolean | undefined;
        yellow?: string | number | boolean | undefined;
        pink?: string | number | boolean | undefined;
        turq?: string | number | boolean | undefined;
        orange?: string | number | boolean | undefined;
    } | undefined;
    fonts?: {
        sans?: string | number | boolean | undefined;
    } | undefined;
    fontSizes?: {
        1?: string | number | boolean | undefined;
        2?: string | number | boolean | undefined;
        3?: string | number | boolean | undefined;
        4?: string | number | boolean | undefined;
        5?: string | number | boolean | undefined;
        6?: string | number | boolean | undefined;
    } | undefined;
    space?: {
        1?: string | number | boolean | undefined;
        2?: string | number | boolean | undefined;
        3?: string | number | boolean | undefined;
        4?: string | number | boolean | undefined;
        5?: string | number | boolean | undefined;
        6?: string | number | boolean | undefined;
    } | undefined;
    sizes?: {
        1?: string | number | boolean | undefined;
        2?: string | number | boolean | undefined;
        3?: string | number | boolean | undefined;
        4?: string | number | boolean | undefined;
        5?: string | number | boolean | undefined;
        6?: string | number | boolean | undefined;
    } | undefined;
    radii?: {
        1?: string | number | boolean | undefined;
        2?: string | number | boolean | undefined;
        3?: string | number | boolean | undefined;
        round?: string | number | boolean | undefined;
    } | undefined;
    fontWeights?: {} | undefined;
    lineHeights?: {} | undefined;
    letterSpacings?: {} | undefined;
    borderWidths?: {} | undefined;
    borderStyles?: {} | undefined;
    shadows?: {} | undefined;
    zIndices?: {} | undefined;
    transitions?: {} | undefined;
} & {
    [x: string]: {
        [x: string]: string | number | boolean;
        [x: number]: string | number | boolean;
    };
})>(nameOrScalesArg0: Argument0, nameOrScalesArg1?: Argument1 | undefined) => string & {
    className: string;
    selector: string;
} & (Argument0 extends string ? import("@stitches/react/types/stitches").ThemeTokens<Argument1, ""> : import("@stitches/react/types/stitches").ThemeTokens<Argument0, "">);
export declare const darkTheme: string & {
    className: string;
    selector: string;
} & import("@stitches/react/types/stitches").ThemeTokens<{
    colors: {
        hiContrast: string;
        loContrast: string;
        gray100: string;
        gray200: string;
        gray300: string;
        gray400: string;
        gray500: string;
        gray600: string;
    };
    space: {};
    fonts: {};
}, "">;
//# sourceMappingURL=stitches.config.d.ts.map