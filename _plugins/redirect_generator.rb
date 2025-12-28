module Jekyll
  class RedirectPage < Page
    def initialize(site, base, dir, redirect_to)
      @site = site
      @base = base
      @dir = dir
      @name = 'index.html'

      self.process(@name)
      self.read_yaml(File.join(base, '_layouts'), 'redirect.html')
      self.data['redirect_to'] = redirect_to
      self.data['sitemap'] = false
    end
  end

  class RedirectGenerator < Generator
    safe true
    priority :low

    def generate(site)
      # Map Tumblr post IDs to their new URLs
      tumblr_redirects = {}
      
      site.posts.docs.each do |post|
        if post.data['tumblr_url']
          # Extract the post ID from the tumblr_url
          # Format: https://blog.safia.rocks/post/136973747045/thanks-for-the-compliment
          if match = post.data['tumblr_url'].match(/\/post\/(\d+)\//)
            post_id = match[1]
            slug = post.data['tumblr_url'].split('/').last
            
            # Create redirect for /post/ID/slug
            tumblr_redirects["/post/#{post_id}/#{slug}"] = post.url
            
            # Also create redirect for /post/ID (without slug)
            tumblr_redirects["/post/#{post_id}"] = post.url
            
            # Create redirect for /post/ID/slug/embed
            tumblr_redirects["/post/#{post_id}/#{slug}/embed"] = post.url
            
            # Create redirect for /post/ID/embed
            tumblr_redirects["/post/#{post_id}/embed"] = post.url
          end
        end
        
        # Handle legacy HTML URLs
        # Map /2018-01-15-how-does-the-node-main-process-start/ to current URL
        if post.url
          # Extract slug from current URL
          if post_match = post.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\/(.+)\/$/)
            year, month, day, slug = post_match[1], post_match[2], post_match[3], post_match[4]
            
            # Create redirects for old HTML extension URLs
            tumblr_redirects["/#{year}-#{month}-#{day}-#{slug}/"] = post.url
            tumblr_redirects["/#{year}-#{month}-#{day}-#{slug}"] = post.url
          end
        end
      end

      # Additional manual redirects for specific problematic URLs
      manual_redirects = {
        "/ask" => "/",
        "/past" => "/archive",
        "/rss" => "/atom.xml",
        "/page2" => "/archive",
        "/analytics.html" => "/",
        "/rolling-in-render-trees.html" => "/2020/10/26/rolling-in-render-trees/",
        "/looking-at-the-curl-stack-trace-part-1.html" => "/2018/05/14/looking-at-the-curl-stack-trace-part-1/",
        "/how-does-git-add-work-under-the-hood.html" => "/2018/03/28/how-does-git-add-work-under-the-hood/",
        "/cdn-cgi/l/email-protection" => "https://safia.rocks",
        "/combing-through-component-base" => "/2020/10/14/combing-through-component-base/",
        "/brief" => "https://safia.rocks",
      }
      
      # Handle malformed paths with .md extensions and nested date directories
      # These appear to be build artifacts that shouldn't have been crawled
      # We'll redirect them all to the home page
      malformed_patterns = [
        /^\/\d{4}\/\d{2}\/\d{2}\/\d{4}\//, # Nested date directories
        /\/_posts\//, # _posts in URL
        /\.md$/, # .md extension
      ]
      
      # For now, we can't dynamically create redirects for these patterns
      # But the 404 page JavaScript will handle them

      all_redirects = tumblr_redirects.merge(manual_redirects)

      all_redirects.each do |old_path, new_path|
        # Clean up the old path
        redirect_dir = old_path.sub(/^\//, '').sub(/\/$/, '')
        
        # Skip if the directory is empty (root redirect)
        next if redirect_dir.empty?
        
        # Create the redirect page
        site.pages << RedirectPage.new(site, site.source, redirect_dir, new_path)
      end

      puts "Generated #{all_redirects.size} redirect pages"
    end
  end
end
