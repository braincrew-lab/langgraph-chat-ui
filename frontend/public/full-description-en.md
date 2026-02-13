# Agent Chat UI User Guide

Welcome to Agent Chat UI. This guide will help you effectively utilize all the features of the chat interface.

## 🚀 Getting Started

### How to Start a Conversation

**Direct Input**

Type your question or message in the input field at the bottom of the screen, then click the send button or press Enter.

**Using Conversation Starter Prompts**

Click on the example conversation starter buttons displayed on the home screen to automatically send that question. This is a convenient way to quickly start a conversation with the AI.

### ⌨️ Keyboard Shortcuts

- `Enter`: Send message
- `Shift + Enter`: Insert a new line
- `Cmd/Ctrl + Enter`: Send message in edit mode

## ✨ Key Features

### 📎 File Upload

You can attach images or PDF documents to the chat.

**Upload Methods**

- Click the clip icon on the left side of the input field to select a file
- Drag and drop files into the chat window
- Copy and paste images from your clipboard

**Supported File Formats**

- Images: JPEG, PNG, GIF, WebP
- Documents: PDF

### 🔧 Tool Call Display Control

The AI uses various tools in the process of generating responses. Click the wrench icon to show or hide these tool call processes.

**Show Mode**: View the AI's work process in detail.
**Hide Mode**: Display only the final result in a clean view.

### 📚 Conversation History Management

**Sidebar Access**

Click the toggle button in the upper left corner to open the conversation history sidebar. Here you can browse the list of previous conversations and select the one you want.

**Conversation Titles**

Each conversation has an automatically generated title, which you can edit by clicking on it. Setting meaningful titles makes it easier to find conversations later.

**Deleting Conversations**

You can delete conversations that are no longer needed. Simply select the delete option on each conversation item.

### 🔄 Regenerate Response

If you're not satisfied with the AI's answer, click the regenerate button at the bottom of the message to receive a new response. The AI will generate an answer from a different perspective or with different phrasing for the same question.

## ⚙️ Settings

You can change various options through the settings button in the lower right corner of the screen.

### 🎨 Appearance Settings

**Color Theme**

- Light Mode: A theme with a bright background
- Dark Mode: A theme with a dark background
- Auto Mode: Automatically switches based on system settings

**Font Style**

- Sans Serif: A clean default font
- Serif: A comfortable reading serif font
- Monospace: A fixed-width font suitable for code

**Font Size**

Choose from Small, Medium, or Large. Adjust according to your readability preference.

### 💡 UI Behavior Settings

**Chat Width**

- Default: A comfortable medium width for reading (768px)
- Wide: A wider layout to view more information at once (1280px)

**Auto-collapse Tool Calls**

When enabled, tool call details are automatically collapsed after the AI's response is complete, keeping the conversation history clean.

## 🎯 Advanced Usage

### Context Retention

Within the same conversation, the context from previous messages is automatically retained. This means you don't need to re-explain the full background every time you ask follow-up questions.

**Example**

```
User: "Make a simple calculator in Python"
AI: [provides code]
User: "Add a square root function to it"
AI: [provides updated code]
```

### 📝 Markdown Support

AI responses are rendered in markdown format. The following elements are supported:

- **Headings**: Hierarchical structure
- **Lists**: Ordered lists, unordered lists
- **Links**: Clickable hyperlinks
- **Code Blocks**: Code with syntax highlighting
- **Tables**: Organized data display

### 💻 Code Highlighting

Code blocks are automatically syntax-highlighted based on the programming language. Click the copy button in the upper right corner of the code block to copy the code to your clipboard.

### 📐 Math Rendering

Mathematical formulas using LaTeX syntax are rendered cleanly. Even complex mathematical expressions are displayed clearly.

## 🔍 Troubleshooting

### Messages Not Sending

1. Check your internet connection
2. Refresh the browser and try again
3. If the problem persists, check the console in the developer tools

### File Upload Failure

1. Make sure the file size does not exceed the limit
2. Verify the file is a supported format (JPEG, PNG, GIF, WebP, PDF)
3. Ensure the browser has permission to access files

### Conversation History Not Visible

1. Click the sidebar toggle button in the upper left corner to open the sidebar
2. Check that the conversation history display option is enabled in settings

### Settings Changes Not Applied

Perform a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to clear the cache and try again.

## 💡 Useful Tips

### Ask Clear Questions

The more specific and clear your questions are, the more accurate the answers you'll receive. Provide background information or constraints when needed.

### Separate Your Conversations

It's best to start a new conversation for different topics. This keeps the context of each conversation clearly defined.

### Regular Cleanup

Delete conversations that are no longer needed to keep your conversation list tidy.

## 🖥️ Technical Specifications

### Supported Browsers

- Chrome 90 and above
- Firefox 88 and above
- Safari 14 and above
- Edge 90 and above

### Recommended Environment

- Stable internet connection
- Latest version of a web browser
- JavaScript enabled

## 📚 Additional Information

For more detailed technical documentation or developer guides, refer to the README.md file in the project repository.

- YouTube Channel: [TeddyNote](https://youtube.com/c/teddynote)
- LangChain Documentation: [LangChain Documentation](https://docs.langchain.com/)
- Next.js Documentation: [nextjs.org/docs](https://nextjs.org/docs)

---

**Version**: 1.0.0
**Last Updated**: November 8, 2025
