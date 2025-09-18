/*
  DOI Annotation API Test Page
  Test the DOI batch upload functionality
*/

'use client';

import React, { useState } from 'react';

export default function DOIAPITest() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testDOIUpload = async () => {
    setLoading(true);
    setResult('Testing DOI batch upload...');
    
    try {
      const testData = {
        documentInfo: {
          identifier: {
            type: 'doi',
            value: '10.1000/test-document',
            normalized: '10.1000/test-document'
          },
          title: 'Test Research Paper',
          authors: [
            {
              firstName: 'John',
              lastName: 'Doe',
              name: 'John Doe',
              creatorType: 'author'
            }
          ],
          publication: {
            journal: 'Test Journal',
            volume: '1',
            issue: '1',
            pages: '1-10'
          },
          year: '2023'
        },
        annotations: [
          {
            id: 'test-annotation-1',
            type: 'highlight',
            documentId: 'doi_10_1000_test_document',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            version: '1.0',
            content: {
              text: 'This is a test highlight',
              comment: 'Test comment',
              color: '#ffff00'
            },
            metadata: {
              platform: 'zotero',
              author: {
                name: 'Test User',
                id: 'test-user',
                isAuthoritative: false
              },
              visibility: 'public',
              documentInfo: {
                title: 'Test Research Paper',
                doi: '10.1000/test-document'
              }
            }
          }
        ],
        source: 'zotero',
        version: '1.0'
      };

      const response = await fetch('/api/v1/annotations/doi-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      const responseData = await response.json();
      
      setResult(`Status: ${response.status}\n\nResponse:\n${JSON.stringify(responseData, null, 2)}`);
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testDOIRetrieval = async () => {
    setLoading(true);
    setResult('Testing DOI annotation retrieval...');
    
    try {
      const response = await fetch('/api/v1/annotations/doi-batch?doi=10.1000/test-document');
      const responseData = await response.json();
      
      setResult(`Status: ${response.status}\n\nResponse:\n${JSON.stringify(responseData, null, 2)}`);
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const clearStorage = async () => {
    setLoading(true);
    setResult('Clearing test storage...');
    
    try {
      const response = await fetch('/api/v1/annotations/doi-batch', {
        method: 'DELETE'
      });
      const responseData = await response.json();
      
      setResult(`Status: ${response.status}\n\nResponse:\n${JSON.stringify(responseData, null, 2)}`);
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            📊 DOI Annotation API Testing
          </h1>
          
          <div className="space-y-4 mb-6">
            <button
              onClick={testDOIUpload}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium"
            >
              {loading ? '⏳ Processing...' : '📤 Test DOI Upload'}
            </button>
            
            <button
              onClick={testDOIRetrieval}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium ml-4"
            >
              {loading ? '⏳ Processing...' : '📥 Test DOI Retrieval'}
            </button>
            
            <button
              onClick={clearStorage}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium ml-4"
            >
              {loading ? '⏳ Processing...' : '🗑️ Clear Storage'}
            </button>
          </div>

          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">API Test Results:</h3>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
              {result || 'No test results yet. Click a button above to test the API.'}
            </pre>
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">📋 API Endpoints:</h3>
            <ul className="space-y-1 text-sm text-blue-700">
              <li><code>POST /api/v1/annotations/doi-batch</code> - Upload DOI-based annotations</li>
              <li><code>GET /api/v1/annotations/doi-batch?doi=VALUE</code> - Retrieve annotations by DOI</li>
              <li><code>DELETE /api/v1/annotations/doi-batch</code> - Clear test storage</li>
            </ul>
          </div>

          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">🔧 Zotero Plugin Configuration:</h3>
            <p className="text-sm text-yellow-700">
              Make sure your Zotero plugin is configured to use: <code>http://localhost:3003/api/v1</code>
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              The plugin will automatically detect DOI-enabled items and use this endpoint for batch uploads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}