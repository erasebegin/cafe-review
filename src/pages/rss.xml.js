import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getAllBlogPosts } from '../lib/sanity-utils';

export async function GET(context) {
	const posts = await getAllBlogPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		trailingSlash: true,
		items: posts.map((post) => ({
			title: post.title,
			description: post.seoDescription || post.description || '',
			link: `/cafe/${post.slug}/`,
			pubDate: post.pubDate,
		})),
	});
}
