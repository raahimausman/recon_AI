import axios from 'axios';

export async function fetchInsight(
  file: File,
  reportType?: string        // e.g. 'INVOICE', 'CHEQUE'
): Promise<string> {
  const form = new FormData();
  form.append('file', file, file.name);
  if (reportType) form.append('report_type', reportType);

  const { data } = await axios.post<{ summary: string }>(
    'http://127.0.0.1:8000/insights',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );

  return data.summary;        // markdown string
}
