/**
 * Apply the light builder theme on component init, restore previous on destroy.
 *
 * Usage in a component:
 *   private themeGuard = useBuilderTheme();
 *   ngOnInit()    { this.themeGuard.apply(); }
 *   ngOnDestroy() { this.themeGuard.restore(); }
 */
const BUILDER_THEME = "tfc-builder";

export function useBuilderTheme(): { apply(): void; restore(): void } {
  let previousTheme: string | null = null;

  return {
    apply(): void {
      previousTheme =
        document.documentElement.getAttribute("data-theme") ?? null;
      document.documentElement.setAttribute("data-theme", BUILDER_THEME);
    },
    restore(): void {
      if (previousTheme) {
        document.documentElement.setAttribute("data-theme", previousTheme);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    },
  };
}
