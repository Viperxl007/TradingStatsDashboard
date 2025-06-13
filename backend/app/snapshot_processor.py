"""
Snapshot Processor Module

This module handles image processing and validation utilities for chart analysis.
It provides image preprocessing, validation, and optimization for AI analysis.
"""

import logging
import hashlib
import io
from typing import Dict, Any, Optional, Tuple
from PIL import Image, ImageEnhance, ImageFilter
import base64

logger = logging.getLogger(__name__)

class SnapshotProcessor:
    """
    Processes and validates chart images for AI analysis.
    
    This class handles image preprocessing, validation, and optimization
    to ensure high-quality input for chart analysis.
    """
    
    def __init__(self):
        """Initialize the snapshot processor with default settings."""
        self.max_file_size = 10 * 1024 * 1024  # 10MB
        self.max_dimensions = (2048, 2048)
        self.min_dimensions = (200, 200)
        self.supported_formats = {'PNG', 'JPEG', 'JPG', 'WEBP'}
        self.target_format = 'PNG'
        self.quality_threshold = 0.1  # Lower threshold to be more permissive for real charts
    
    def validate_image(self, image_data: bytes) -> Dict[str, Any]:
        """
        Validate image data for chart analysis.
        
        Args:
            image_data (bytes): Raw image data
            
        Returns:
            Dict[str, Any]: Validation results with status and details
        """
        try:
            validation_result = {
                'is_valid': False,
                'errors': [],
                'warnings': [],
                'image_info': {}
            }
            
            # Check file size
            if len(image_data) > self.max_file_size:
                validation_result['errors'].append(f"File size {len(image_data)} exceeds maximum {self.max_file_size}")
                return validation_result
            
            if len(image_data) < 1024:  # Minimum 1KB
                validation_result['errors'].append("File size too small, likely corrupted")
                return validation_result
            
            # Try to open and validate image
            try:
                with Image.open(io.BytesIO(image_data)) as img:
                    # Check format
                    if img.format not in self.supported_formats:
                        validation_result['errors'].append(f"Unsupported format: {img.format}")
                        return validation_result
                    
                    # Check dimensions
                    width, height = img.size
                    if width < self.min_dimensions[0] or height < self.min_dimensions[1]:
                        validation_result['errors'].append(f"Image too small: {width}x{height}, minimum: {self.min_dimensions}")
                        return validation_result
                    
                    if width > self.max_dimensions[0] or height > self.max_dimensions[1]:
                        validation_result['warnings'].append(f"Image large: {width}x{height}, will be resized")
                    
                    # Check if image is likely a chart
                    chart_quality = self._assess_chart_quality(img)
                    if chart_quality < self.quality_threshold:
                        validation_result['warnings'].append(f"Low chart quality score: {chart_quality:.2f}")
                    
                    # Store image info
                    validation_result['image_info'] = {
                        'format': img.format,
                        'size': img.size,
                        'mode': img.mode,
                        'file_size': len(image_data),
                        'chart_quality': chart_quality
                    }
                    
                    validation_result['is_valid'] = True
                    logger.info(f"Image validation passed: {width}x{height} {img.format}")
                    
            except Exception as e:
                validation_result['errors'].append(f"Cannot open image: {str(e)}")
                return validation_result
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating image: {str(e)}")
            return {
                'is_valid': False,
                'errors': [f"Validation error: {str(e)}"],
                'warnings': [],
                'image_info': {}
            }
    
    def process_image(self, image_data: bytes, optimize_for_ai: bool = True) -> Dict[str, Any]:
        """
        Process and optimize image for AI analysis.
        
        Args:
            image_data (bytes): Raw image data
            optimize_for_ai (bool): Whether to apply AI-specific optimizations
            
        Returns:
            Dict[str, Any]: Processing results with optimized image data
        """
        try:
            # Validate image first
            validation = self.validate_image(image_data)
            if not validation['is_valid']:
                return {
                    'success': False,
                    'error': 'Image validation failed',
                    'validation': validation
                }
            
            with Image.open(io.BytesIO(image_data)) as img:
                processed_img = img.copy()
                
                # Convert to RGB if necessary
                if processed_img.mode in ('RGBA', 'LA', 'P'):
                    # Create white background for transparency
                    background = Image.new('RGB', processed_img.size, (255, 255, 255))
                    if processed_img.mode == 'P':
                        processed_img = processed_img.convert('RGBA')
                    background.paste(processed_img, mask=processed_img.split()[-1] if processed_img.mode in ('RGBA', 'LA') else None)
                    processed_img = background
                
                # Resize if too large
                if processed_img.size[0] > self.max_dimensions[0] or processed_img.size[1] > self.max_dimensions[1]:
                    processed_img.thumbnail(self.max_dimensions, Image.Resampling.LANCZOS)
                    logger.info(f"Resized image to {processed_img.size}")
                
                # Apply AI-specific optimizations
                if optimize_for_ai:
                    processed_img = self._optimize_for_ai_analysis(processed_img)
                
                # Convert to target format
                output_buffer = io.BytesIO()
                processed_img.save(output_buffer, format=self.target_format, optimize=True)
                processed_data = output_buffer.getvalue()
                
                # Generate image hash for deduplication
                image_hash = self.generate_image_hash(processed_data)
                
                result = {
                    'success': True,
                    'processed_data': processed_data,
                    'image_hash': image_hash,
                    'original_size': validation['image_info']['size'],
                    'processed_size': processed_img.size,
                    'file_size_reduction': len(image_data) - len(processed_data),
                    'format': self.target_format,
                    'optimizations_applied': optimize_for_ai
                }
                
                logger.info(f"Image processed successfully: {result['original_size']} -> {result['processed_size']}")
                return result
                
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _assess_chart_quality(self, img: Image.Image) -> float:
        """
        Assess if image looks like a financial chart.
        
        Args:
            img (Image.Image): PIL Image object
            
        Returns:
            float: Quality score (0.0 to 1.0)
        """
        try:
            # Convert to grayscale for analysis
            gray_img = img.convert('L')
            
            # Calculate basic image statistics
            width, height = img.size
            aspect_ratio = width / height
            
            # Check aspect ratio (charts are usually wider than tall)
            aspect_score = 1.0 if 1.2 <= aspect_ratio <= 3.0 else 0.5
            
            # Check for sufficient contrast (charts should have good contrast)
            import numpy as np
            img_array = np.array(gray_img)
            contrast = img_array.std() / 255.0
            contrast_score = min(contrast * 2, 1.0)  # Normalize to 0-1
            
            # Check for line-like structures (charts have many lines)
            edges = gray_img.filter(ImageFilter.FIND_EDGES)
            edge_array = np.array(edges)
            edge_density = np.count_nonzero(edge_array) / (width * height)
            edge_score = min(edge_density * 10, 1.0)  # Normalize to 0-1
            
            # Check for text presence (charts usually have labels)
            # Simple heuristic: look for small high-contrast regions
            text_regions = 0
            block_size = 20
            for y in range(0, height - block_size, block_size):
                for x in range(0, width - block_size, block_size):
                    block = img_array[y:y+block_size, x:x+block_size]
                    if block.std() > 50:  # High contrast block
                        text_regions += 1
            
            text_score = min(text_regions / 100, 1.0)  # Normalize
            
            # Combine scores
            quality_score = (aspect_score * 0.2 + contrast_score * 0.3 + 
                           edge_score * 0.3 + text_score * 0.2)
            
            return quality_score
            
        except Exception as e:
            logger.warning(f"Error assessing chart quality: {str(e)}")
            return 0.5  # Default neutral score
    
    def _optimize_for_ai_analysis(self, img: Image.Image) -> Image.Image:
        """
        Apply AI-specific optimizations to improve analysis accuracy.
        
        Args:
            img (Image.Image): PIL Image object
            
        Returns:
            Image.Image: Optimized image
        """
        try:
            # Enhance contrast for better AI recognition
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.1)  # Slight contrast boost
            
            # Enhance sharpness for better line detection
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(1.05)  # Slight sharpness boost
            
            # Reduce noise while preserving edges
            img = img.filter(ImageFilter.MedianFilter(size=3))
            
            logger.debug("Applied AI optimization filters")
            return img
            
        except Exception as e:
            logger.warning(f"Error applying AI optimizations: {str(e)}")
            return img  # Return original if optimization fails
    
    def generate_image_hash(self, image_data: bytes) -> str:
        """
        Generate a hash for image deduplication.
        
        Args:
            image_data (bytes): Image data
            
        Returns:
            str: SHA-256 hash of the image
        """
        return hashlib.sha256(image_data).hexdigest()
    
    def extract_image_metadata(self, image_data: bytes) -> Dict[str, Any]:
        """
        Extract metadata from image.
        
        Args:
            image_data (bytes): Raw image data
            
        Returns:
            Dict[str, Any]: Image metadata
        """
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                metadata = {
                    'format': img.format,
                    'size': img.size,
                    'mode': img.mode,
                    'file_size': len(image_data),
                    'has_transparency': img.mode in ('RGBA', 'LA', 'P'),
                }
                
                # Extract EXIF data if available
                if hasattr(img, '_getexif') and img._getexif():
                    exif_data = img._getexif()
                    if exif_data:
                        metadata['exif'] = {
                            'datetime': exif_data.get(306),  # DateTime
                            'software': exif_data.get(305),  # Software
                            'make': exif_data.get(271),      # Make
                            'model': exif_data.get(272),     # Model
                        }
                
                return metadata
                
        except Exception as e:
            logger.warning(f"Error extracting image metadata: {str(e)}")
            return {'error': str(e)}
    
    def create_thumbnail(self, image_data: bytes, size: Tuple[int, int] = (200, 200)) -> Optional[bytes]:
        """
        Create a thumbnail of the image.
        
        Args:
            image_data (bytes): Original image data
            size (Tuple[int, int]): Thumbnail size
            
        Returns:
            Optional[bytes]: Thumbnail image data or None if failed
        """
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                # Create thumbnail
                img.thumbnail(size, Image.Resampling.LANCZOS)
                
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = background
                
                # Save thumbnail
                output_buffer = io.BytesIO()
                img.save(output_buffer, format='JPEG', quality=85, optimize=True)
                return output_buffer.getvalue()
                
        except Exception as e:
            logger.error(f"Error creating thumbnail: {str(e)}")
            return None
    
    def convert_to_base64(self, image_data: bytes) -> str:
        """
        Convert image data to base64 string.
        
        Args:
            image_data (bytes): Image data
            
        Returns:
            str: Base64 encoded image
        """
        return base64.b64encode(image_data).decode('utf-8')
    
    def convert_from_base64(self, base64_string: str) -> bytes:
        """
        Convert base64 string to image data.
        
        Args:
            base64_string (str): Base64 encoded image
            
        Returns:
            bytes: Image data
        """
        try:
            # Remove data URL prefix if present
            if base64_string.startswith('data:image/'):
                base64_string = base64_string.split(',', 1)[1]
            
            return base64.b64decode(base64_string)
        except Exception as e:
            logger.error(f"Error converting from base64: {str(e)}")
            raise ValueError(f"Invalid base64 image data: {str(e)}")

# Global instance
snapshot_processor = SnapshotProcessor()