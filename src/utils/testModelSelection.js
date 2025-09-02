/**
 * Test Model Selection Functionality
 * 
 * This script can be run in the browser console to test the model selection
 * functionality in the AI Chart Analysis interface.
 */

// Test function to verify model selection is working
window.testModelSelection = function() {
  console.log('🧪 Testing Model Selection Functionality');
  console.log('=' .repeat(50));
  
  // Test 1: Check if models API is accessible
  console.log('📡 Test 1: Checking models API...');
  fetch('http://localhost:5000/api/chart-analysis/models')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('✅ Models API is working');
        console.log(`📋 Available models: ${data.models.length}`);
        console.log(`🎯 Default model: ${data.default_model}`);
        
        // List all models
        data.models.forEach((model, index) => {
          console.log(`   ${index + 1}. ${model.name} (${model.id})`);
        });
        
        // Test 2: Check localStorage
        console.log('\n💾 Test 2: Checking localStorage...');
        const storedModel = localStorage.getItem('selectedClaudeModel');
        console.log(`📦 Stored model: ${storedModel || 'None'}`);
        
        // Test 3: Simulate model selection
        console.log('\n🔄 Test 3: Simulating model selection...');
        const testModel = 'claude-opus-4-1-20250805';
        localStorage.setItem('selectedClaudeModel', testModel);
        console.log(`✅ Set model to: ${testModel}`);
        
        // Verify storage
        const verifyModel = localStorage.getItem('selectedClaudeModel');
        if (verifyModel === testModel) {
          console.log('✅ Model storage verification passed');
        } else {
          console.log('❌ Model storage verification failed');
        }
        
        // Test 4: Check if ModelSelector component exists
        console.log('\n🔍 Test 4: Checking for ModelSelector component...');
        const modelSelectors = document.querySelectorAll('select');
        let foundModelSelector = false;
        
        modelSelectors.forEach(select => {
          const options = Array.from(select.options);
          const hasClaudeModels = options.some(option => 
            option.value.includes('claude-') || option.textContent.includes('Claude')
          );
          
          if (hasClaudeModels) {
            foundModelSelector = true;
            console.log('✅ Found ModelSelector component');
            console.log(`📋 Current selection: ${select.value}`);
            console.log(`📊 Available options: ${options.length}`);
            
            // List options
            options.forEach((option, index) => {
              if (option.value) {
                console.log(`   ${index + 1}. ${option.textContent} (${option.value})`);
              }
            });
          }
        });
        
        if (!foundModelSelector) {
          console.log('⚠️  ModelSelector component not found or not loaded');
        }
        
        console.log('\n🎉 Model Selection Test Complete!');
        console.log('💡 To manually test:');
        console.log('   1. Open the AI Chart Analysis tab');
        console.log('   2. Look for the model selection dropdown');
        console.log('   3. Try changing the model selection');
        console.log('   4. Verify the selection persists after page refresh');
        
      } else {
        console.log('❌ Models API failed:', data);
      }
    })
    .catch(error => {
      console.log('❌ Models API error:', error);
      console.log('💡 Make sure the backend server is running on http://localhost:5000');
    });
};

// Test function to check current model selection state
window.checkModelState = function() {
  console.log('🔍 Current Model Selection State');
  console.log('=' .repeat(40));
  
  const storedModel = localStorage.getItem('selectedClaudeModel');
  console.log(`💾 localStorage model: ${storedModel || 'None'}`);
  
  // Check if there are any select elements with Claude models
  const selects = document.querySelectorAll('select');
  selects.forEach((select, index) => {
    const options = Array.from(select.options);
    const hasClaudeModels = options.some(option => 
      option.value.includes('claude-') || option.textContent.includes('Claude')
    );
    
    if (hasClaudeModels) {
      console.log(`🎯 ModelSelector ${index + 1}:`);
      console.log(`   Current value: ${select.value}`);
      console.log(`   Selected text: ${select.selectedOptions[0]?.textContent || 'None'}`);
      console.log(`   Is disabled: ${select.disabled}`);
    }
  });
};

// Test function to simulate model change
window.simulateModelChange = function(modelId) {
  console.log(`🔄 Simulating model change to: ${modelId}`);
  
  // Update localStorage
  localStorage.setItem('selectedClaudeModel', modelId);
  console.log('✅ Updated localStorage');
  
  // Find and update select element
  const selects = document.querySelectorAll('select');
  let updated = false;
  
  selects.forEach(select => {
    const options = Array.from(select.options);
    const hasClaudeModels = options.some(option => 
      option.value.includes('claude-') || option.textContent.includes('Claude')
    );
    
    if (hasClaudeModels) {
      const targetOption = options.find(option => option.value === modelId);
      if (targetOption) {
        select.value = modelId;
        
        // Trigger change event
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
        
        console.log('✅ Updated select element and triggered change event');
        updated = true;
      }
    }
  });
  
  if (!updated) {
    console.log('⚠️  Could not find select element or model option');
  }
  
  // Verify the change
  setTimeout(() => {
    checkModelState();
  }, 100);
};

console.log('🧪 Model Selection Test Functions Loaded!');
console.log('📋 Available functions:');
console.log('   • testModelSelection() - Run comprehensive test');
console.log('   • checkModelState() - Check current state');
console.log('   • simulateModelChange(modelId) - Simulate model change');
console.log('');
console.log('💡 Example usage:');
console.log('   testModelSelection()');
console.log('   simulateModelChange("claude-opus-4-1-20250805")');