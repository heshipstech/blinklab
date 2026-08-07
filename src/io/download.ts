export function downloadTextFile(
  filename: string,
  text: string,
  // Defaults to JSON for the 2.7 fixture recorder, its first caller.
  // The CSV export passes text/csv: at the border to another program
  // the file's own declaration of what it is IS the contract.
  mimeType = "application/json",
): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
