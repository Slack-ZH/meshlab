const normalized=text=>String(text).normalize('NFKC').toLocaleLowerCase().trim();
export function matchesQuery(text,query){
  const haystack=normalized(text);
  return normalized(query).split(/\s+/).filter(Boolean).every(word=>haystack.includes(word));
}
