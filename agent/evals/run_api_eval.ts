if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY to run API evals (billed separately). Skipping.");
  process.exit(0);
}
console.error("API eval stub: add photos under evals/photos and extend this script.");
