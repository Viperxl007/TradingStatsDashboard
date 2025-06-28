import sys
import os
sys.path.append('backend')
from backend.services.analysis_context_service import AnalysisContextService

# Test the enhanced context service
context_service = AnalysisContextService()

print('Testing comprehensive context retrieval for SOLUSD...')
context = context_service.get_comprehensive_context('SOLUSD', '1h', 146.86)

if context:
    print('Context found!')
    print(f'   Analysis ID: {context.get("analysis_id")}')
    print(f'   Hours ago: {context.get("hours_ago", 0):.1f}')
    print(f'   Action: {context.get("action")}')
    print(f'   Context type: {context.get("context_type")}')
else:
    print('No context found!')