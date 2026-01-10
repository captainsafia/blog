import { ImageResponse } from '@vercel/og';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { parseDateFromFilename, formatDate, calculateReadTime } from '../../utils/blog';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  
  return posts.map((post) => {
    const dateFromFilename = parseDateFromFilename(post.id);
    const date = post.data.date || dateFromFilename;
    const readTime = calculateReadTime(post.body);
    
    // Parse the post ID to get the URL slug
    const match = post.id.match(/(\d{4})\/(\d{4})-(\d{2})-(\d{2})-(.*)$/);
    let slug = post.id;
    if (match) {
      const [, , year, month, day, urlSlug] = match;
      slug = `${year}-${month}-${day}-${urlSlug}`;
    } else {
      // Handle tumblr posts
      const tumblrMatch = post.id.match(/(?:tumblr\/)?(.*)/);
      if (tumblrMatch) {
        slug = tumblrMatch[1];
      }
    }
    
    return {
      params: { slug },
      props: {
        title: post.data.title,
        date: date ? formatDate(date) : '',
        readTime: `${readTime} min read`,
      }
    };
  });
}

export const GET: APIRoute = async ({ props }) => {
  const { title, date, readTime } = props as { title: string; date: string; readTime: string };
  
  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          background: 'linear-gradient(to bottom, #fafaf8, #f5f5f3)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        },
        children: [
          // Top: Site icon/logo
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 48,
                    },
                    children: '🐛'
                  }
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 32,
                      fontWeight: 700,
                      color: '#1a1a1a',
                    },
                    children: 'Bug Repellent'
                  }
                }
              ]
            }
          },
          // Center: Title
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flex: 1,
                paddingTop: '40px',
                paddingBottom: '40px',
              },
              children: {
                type: 'div',
                props: {
                  style: {
                    fontSize: 56,
                    fontWeight: 700,
                    color: '#1a1a1a',
                    lineHeight: 1.2,
                    maxWidth: '90%',
                  },
                  children: title,
                }
              }
            }
          },
          // Bottom: Date and read time
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                paddingBottom: '20px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 28,
                      color: '#666',
                    },
                    children: date,
                  }
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 28,
                      color: '#999',
                    },
                    children: '•'
                  }
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 28,
                      color: '#666',
                    },
                    children: readTime,
                  }
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 28,
                      color: '#999',
                    },
                    children: '•'
                  }
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 28,
                      color: '#666',
                    },
                    children: '@captainsafia',
                  }
                }
              ]
            }
          },
          // Bottom border
          {
            type: 'div',
            props: {
              style: {
                width: 'calc(100% + 160px)',
                height: '20px',
                background: '#6b8e3f',
                marginBottom: '-60px',
                marginRight: '-80px',
                marginLeft: '-80px',
              }
            }
          }
        ]
      }
    },
    {
      width: 1200,
      height: 630,
    }
  );
};
