export function difficultyBadgeVariant(
  difficulty: string
): "success" | "warning" | "default" | "secondary" {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "success";
    case "medium":
      return "warning";
    case "hard":
      return "default";
    default:
      return "secondary";
  }
}
