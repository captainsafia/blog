import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { parseDateFromFilename, getPostUrl } from '../utils/blog';

export async function GET(context: any) {
  const blog = await getCollection('blog');
  
  const posts = blog
    .map(post => {
      const dateFromFilename = parseDateFromFilename(post.id);
      return {
        ...post,
        data: {
          ...post.data,
          date: post.data.date || dateFromFilename
        }
      };
    })
    .filter(post => post.data.date)
    .sort((a, b) => b.data.date!.getTime() - a.data.date!.getTime());

  return rss({
    title: 'Bug Repellent',
    description: 'The blog of @captainsafia',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description || '',
      pubDate: post.data.date!,
      link: getPostUrl(post.id),
    })),
    customData: `<language>en-us</language>`,
  });
}
