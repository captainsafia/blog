module Jekyll
  # This plugin prevents malformed OG image URLs from being generated
  # The jekyll-og-image plugin sometimes outputs Ruby hash objects instead of paths
  
  class OgImageCleanup < Generator
    safe true
    priority :lowest  # Run after og-image generation

    def generate(site)
      # Remove any pages with malformed URLs containing hash syntax
      site.pages.delete_if do |page|
        page.url && page.url.include?('{"path" =>')
      end

      # Also check static files
      site.static_files.delete_if do |file|
        file.url && file.url.include?('{"path" =>')
      end
      
      puts "Cleaned up malformed OG image URLs"
    end
  end
end
