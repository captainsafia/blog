// Parse date from Jekyll filename format (YYYY-MM-DD-title.md)
export function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})-/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return null;
}

// Calculate read time excluding code blocks and mermaid diagrams
export function calculateReadTime(content: string): number {
  // Remove code blocks
  let text = content.replace(/```[\s\S]*?```/g, '');
  
  // Remove mermaid diagrams
  text = text.replace(/<div class="mermaid">[\s\S]*?<\/div>/g, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Count words
  const words = text.trim().split(/\s+/).length;
  
  // Calculate minutes (250 words per minute)
  const minutes = Math.max(1, Math.ceil(words / 250));
  
  return minutes;
}

// Format date for display
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Format date for XML/ISO
export function formatDateXML(date: Date): string {
  return date.toISOString();
}

// Get related posts based on date proximity
export function getRelatedPosts(posts: any[], currentPost: any, limit: number = 3): any[] {
  // Filter out posts without dates and the current post
  const postsWithDates = posts.filter(post => 
    post.id !== currentPost.id && post.data.date
  );
  
  if (!currentPost.data.date || postsWithDates.length === 0) {
    return [];
  }
  
  return postsWithDates
    .sort((a, b) => {
      const aDiff = Math.abs(a.data.date.getTime() - currentPost.data.date.getTime());
      const bDiff = Math.abs(b.data.date.getTime() - currentPost.data.date.getTime());
      return aDiff - bDiff;
    })
    .slice(0, limit);
}

// Generate post URL in Jekyll format
export function getPostUrl(postId: string): string {
  // Try format 1: YYYY/YYYY-MM-DD-slug
  let match = postId.match(/(\d{4})\/(\d{4})-(\d{2})-(\d{2})-(.*)$/);
  if (match) {
    const [, , year, month, day, slug] = match;
    return `/${year}/${month}/${day}/${slug}/`;
  }
  
  // Try format 2: tumblr/YYYY-MM-DD-slug or just YYYY-MM-DD-slug
  match = postId.match(/(?:tumblr\/)?(\d{4})-(\d{2})-(\d{2})-(.*)$/);
  if (match) {
    const [, year, month, day, slug] = match;
    return `/${year}/${month}/${day}/${slug}/`;
  }
  
  return '/';
}
