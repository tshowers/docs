import { videoEmbedUrl } from './document-detail.component';

describe( 'videoEmbedUrl', () => {
  it( 'turns share links into players that do not autoplay', () => {
    expect( videoEmbedUrl( 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3' ) ).toBe( 'https://www.youtube.com/embed/dQw4w9WgXcQ' );
    expect( videoEmbedUrl( 'https://youtu.be/dQw4w9WgXcQ' ) ).toBe( 'https://www.youtube.com/embed/dQw4w9WgXcQ' );
    expect( videoEmbedUrl( 'https://vimeo.com/123456' ) ).toBe( 'https://player.vimeo.com/video/123456' );
    expect( videoEmbedUrl( 'https://storage.example.com/demo.mp4' ) ).toBeNull();
  } );
} );
