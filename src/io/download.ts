export function downloadTextFile(
  filename: string,
  text: string,
  // Defaults to JSON for the 2.7 fixture recorder, its first caller.
  // The CSV export passes text/csv: at the border to another program
  // the file's own declaration of what it is IS the contract.
  mimeType = "application/json",
): string {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  // Returns the name it actually used, so a caller reporting the
  // download to the person cannot drift from the file that was
  // written. The alternative was building the template twice, and the
  // export guard reads the literal AT THIS CALL SITE to check that
  // every downloadable name is refused by .gitignore: assigning the
  // template to a variable first made that guard find zero downloads
  // and pass, which is how a privacy check stops checking.
  return filename;
}
