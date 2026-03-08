import { ChangeDetectionStrategy, Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GoogleGenAI } from "@google/genai";

interface StyleOption {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
}

interface QualityOption {
  id: 'low' | 'medium' | 'high';
  name: string;
  description: string;
}

@Component({
  selector: 'app-headshot-generator',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './headshot-generator.html',
  styleUrl: './headshot-generator.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeadshotGenerator {
  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  isGenerating = signal<boolean>(false);
  generatedImage = signal<string | null>(null);
  error = signal<string | null>(null);

  styles: StyleOption[] = [
    {
      id: 'corporate',
      name: 'Corporate Grey',
      description: 'Classic professional look with a neutral grey studio backdrop.',
      prompt: 'Transform this person into a professional corporate headshot. Change the background to a clean, neutral grey studio backdrop. Ensure the person is wearing a professional suit or blazer. Maintain the facial features and identity of the person perfectly. High-end studio lighting.',
      icon: 'business_center'
    },
    {
      id: 'tech',
      name: 'Modern Tech',
      description: 'Modern office setting with soft bokeh and natural lighting.',
      prompt: 'Transform this person into a modern professional headshot. Change the background to a modern, bright tech office with soft bokeh. The person should look approachable and professional. Maintain the facial features and identity of the person perfectly. Natural, bright lighting.',
      icon: 'laptop_mac'
    },
    {
      id: 'outdoor',
      name: 'Outdoor Natural',
      description: 'Soft natural sunlight with a blurred urban or park background.',
      prompt: 'Transform this person into a professional headshot with an outdoor natural light feel. Change the background to a blurred urban park or city street. Soft, warm sunlight. Maintain the facial features and identity of the person perfectly. Approachable and friendly look.',
      icon: 'wb_sunny'
    },
    {
      id: 'minimalist',
      name: 'Minimalist White',
      description: 'Clean, high-key lighting with a pure white background.',
      prompt: 'Transform this person into a minimalist professional headshot. Change the background to a pure, bright white. High-key lighting, very clean and modern. Maintain the facial features and identity of the person perfectly.',
      icon: 'filter_hdr'
    },
    {
      id: 'executive',
      name: 'Executive Boardroom',
      description: 'Sophisticated boardroom setting for an authoritative look.',
      prompt: 'Transform this person into an executive professional headshot. Change the background to a sophisticated, high-end boardroom or executive office. Authoritative and confident look. Maintain the facial features and identity of the person perfectly. Premium lighting.',
      icon: 'gavel'
    }
  ];

  selectedStyleId = signal<string>(this.styles[0].id);
  selectedStyle = computed(() => this.styles.find(s => s.id === this.selectedStyleId()));

  qualityOptions: QualityOption[] = [
    { id: 'low', name: 'Low', description: 'Small file size, 512px' },
    { id: 'medium', name: 'Medium', description: 'Balanced quality, 1024px' },
    { id: 'high', name: 'High', description: 'Best quality, Original' }
  ];
  selectedQualityId = signal<'low' | 'medium' | 'high'>('high');

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedFile.set(file);
      this.error.set(null);
      this.generatedImage.set(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  onStyleSelect(id: string) {
    this.selectedStyleId.set(id);
  }

  async generateHeadshot() {
    const file = this.selectedFile();
    const style = this.selectedStyle();
    
    if (!file || !style) {
      this.error.set('Please upload a photo and select a style.');
      return;
    }

    this.isGenerating.set(true);
    this.error.set(null);
    this.generatedImage.set(null);

    try {
      if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        throw new Error('API Key is missing or invalid. Please ensure GEMINI_API_KEY is set in your environment.');
      }
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const base64Data = await this.fileToBase64(file);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data.split(',')[1],
                mimeType: file.type,
              },
            },
            {
              text: style.prompt,
            },
          ],
        },
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          this.generatedImage.set(`data:image/png;base64,${part.inlineData.data}`);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        this.error.set('Failed to generate image. Please try again.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during generation.';
      console.error('Generation error:', err);
      this.error.set(errorMessage);
    } finally {
      this.isGenerating.set(false);
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  downloadImage() {
    const imageUrl = this.generatedImage();
    if (!imageUrl) return;

    const quality = this.selectedQualityId();
    
    if (quality === 'high') {
      // Direct download for high quality
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `ai-headshot-${this.selectedStyleId()}-high.png`;
      link.click();
      return;
    }

    // Process image for low/medium quality
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let width = img.width;
      let height = img.height;
      const maxDim = quality === 'low' ? 512 : 1024;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const compression = quality === 'low' ? 0.5 : 0.8;
      const processedUrl = canvas.toDataURL('image/jpeg', compression);

      const link = document.createElement('a');
      link.href = processedUrl;
      link.download = `ai-headshot-${this.selectedStyleId()}-${quality}.jpg`;
      link.click();
    };
    img.src = imageUrl;
  }

  reset() {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.generatedImage.set(null);
    this.error.set(null);
  }
}
