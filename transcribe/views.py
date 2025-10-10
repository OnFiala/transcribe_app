from django.shortcuts import render

def index(request):
    return render(request, 'transcribe/index.html')
# Create your views here.
