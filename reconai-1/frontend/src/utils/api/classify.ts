import axios from 'axios';

export type DetectedResult = {
  file_id: string;
  filename: string;
  detected_type: string;   // INVOICE | PROOF_OF_PAYMENT | …
  match: boolean;
};

export async function classifyFiles(
  expectedType: string,
  files: File[]
): Promise<DetectedResult[]> {
  const form = new FormData();
  form.append('expected_type', expectedType);          // FastAPI query param
  files.forEach(f => form.append('files', f, f.name));

  // put expected_type in the URL
  const url = `http://127.0.0.1:8000/classify?expected_type=${encodeURIComponent(
    expectedType
  )}`;

  const { data } = await axios.post(url, form);

  // Assert the type of data to avoid 'unknown' error
  const results = (data as { results: DetectedResult[] }).results;

  return results;
}